const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");

const createApp = require("../app");
const {
  connectDatabase,
  disconnectDatabase
} = require("../config/database");

const enabled = process.env.RUN_INTEGRATION_TESTS === "true";

/**
 * Node.js versions ke darmiyan Set-Cookie handling compatible rakhta hai.
 */
function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }

  const combinedHeader = response.headers.get("set-cookie");

  if (!combinedHeader) {
    return [];
  }

  return combinedHeader
    .split(/,(?=\s*[^;,=\s]+=[^;,]*)/)
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Set-Cookie response headers ko Cookie request header mein convert karta hai.
 */
function cookieHeaderFrom(response) {
  return getSetCookieHeaders(response)
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

/**
 * Assertion fail hone par response body CI log mein bhi show karta hai.
 */
async function assertStatus(response, expectedStatus, label) {
  const responseBody = await response.clone().text();

  assert.equal(
    response.status,
    expectedStatus,
    [
      `${label}: expected HTTP ${expectedStatus}`,
      `Received HTTP ${response.status}`,
      `Response body: ${responseBody}`
    ].join("\n")
  );
}

test(
  "authentication workflow rejects admin registration and creates a verified session",
  {
    skip: !enabled,
    timeout: 60_000
  },
  async (context) => {
    let server;

    context.after(async () => {
      if (server) {
        await new Promise((resolve) => {
          server.close(resolve);

          if (typeof server.closeAllConnections === "function") {
            server.closeAllConnections();
          }
        });
      }

      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.dropDatabase();
      }

      if (mongoose.connection.readyState !== 0) {
        await disconnectDatabase();
      }
    });

    await connectDatabase();
    await mongoose.connection.db.dropDatabase();

    const app = createApp();
    server = http.createServer(app);

    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    /*
     * 1. CSRF token obtain karein.
     */
    const csrfResponse = await fetch(
      `${baseUrl}/api/v1/auth/csrf`
    );

    await assertStatus(
      csrfResponse,
      200,
      "Get CSRF token"
    );

    const csrfBody = await csrfResponse.json();
    const csrfToken = csrfBody.data.csrfToken;
    const csrfCookie = `ls_csrf=${csrfToken}`;

    /*
     * Har test run ke liye valid aur unique email addresses.
     * example.com Joi email validator ke mutabiq valid domain hai.
     */
    const uniqueId = `${Date.now()}-${process.pid}`;

    /*
     * 2. Public admin registration reject honi chahiye.
     */
    const adminAttempt = await fetch(
      `${baseUrl}/api/v1/auth/register`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
          cookie: csrfCookie
        },
        body: JSON.stringify({
          name: "Unauthorized Admin",
          email: `admin-attempt-${uniqueId}@example.com`,
          password: "StrongPassword123",
          role: "admin"
        })
      }
    );

    await assertStatus(
      adminAttempt,
      400,
      "Reject public administrator registration"
    );

    /*
     * 3. Normal client registration.
     */
    const email = `client-${uniqueId}@example.com`;

    const registerResponse = await fetch(
      `${baseUrl}/api/v1/auth/register`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
          cookie: csrfCookie
        },
        body: JSON.stringify({
          name: "Integration Client",
          email,
          password: "StrongPassword123",
          role: "client",
          city: "Lahore",
          phone: "03001234567"
        })
      }
    );

    await assertStatus(
      registerResponse,
      201,
      "Register client"
    );

    const registration = await registerResponse.json();

    assert.ok(
      registration.data.developmentVerificationToken,
      "The test environment must expose a one-time verification token"
    );

    /*
     * 4. Email verification.
     */
    const verifyResponse = await fetch(
      `${baseUrl}/api/v1/auth/verify-email`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
          cookie: csrfCookie
        },
        body: JSON.stringify({
          token: registration.data.developmentVerificationToken
        })
      }
    );

    await assertStatus(
      verifyResponse,
      200,
      "Verify email"
    );

    /*
     * 5. Verification ke baad authentication cookies milni chahiye.
     */
    const authCookies = cookieHeaderFrom(verifyResponse);

    assert.match(
      authCookies,
      /(?:^|;\s*)ls_access=/,
      "The verification response must set an access-token cookie"
    );

    assert.match(
      authCookies,
      /(?:^|;\s*)ls_refresh=/,
      "The verification response must set a refresh-token cookie"
    );

    /*
     * 6. Authenticated /me endpoint.
     */
    const meResponse = await fetch(
      `${baseUrl}/api/v1/auth/me`,
      {
        headers: {
          accept: "application/json",
          cookie: authCookies
        }
      }
    );

    await assertStatus(
      meResponse,
      200,
      "Load authenticated user"
    );

    const me = await meResponse.json();
    const user = me.data.user;

    assert.equal(user.email, email);
    assert.equal(user.role, "client");
    assert.equal(user.emailVerified, true);

    /*
     * Sensitive/internal fields response mein bilkul present nahi honi chahiye.
     */
    for (const privateField of [
      "passwordHash",
      "tokenVersion",
      "firebaseUid",
      "__v"
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(user, privateField),
        false,
        `${privateField} must not be present in an API user response`
      );
    }
  }
);
