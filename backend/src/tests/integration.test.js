const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const enabled = process.env.RUN_INTEGRATION_TESTS === "true";
const baseUrl = `http://127.0.0.1:${process.env.PORT || 5051}`;

function cookiesFrom(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";")[0]).join("; ");
}

async function waitForServer(child) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`API exited before becoming ready with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error("API did not become ready");
}

test("authentication workflow rejects admin registration and creates a verified session", {
  skip: !enabled,
  timeout: 30000
}, async (context) => {
  const root = path.resolve(__dirname, "../..");
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: process.env.PORT || "5051",
      EXPOSE_DEV_TOKENS: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  context.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        child.once("exit", resolve);
        setTimeout(resolve, 3000).unref();
      });
    }
  });

  try {
    await waitForServer(child);

    const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
    assert.equal(csrfResponse.status, 200);
    const csrfBody = await csrfResponse.json();
    const csrfToken = csrfBody.data.csrfToken;
    const csrfCookie = `ls_csrf=${csrfToken}`;

    const adminAttempt = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        cookie: csrfCookie
      },
      body: JSON.stringify({
        name: "Unauthorized Admin",
        email: `admin-attempt-${Date.now()}@example.test`,
        password: "StrongPassword123",
        role: "admin"
      })
    });
    assert.equal(adminAttempt.status, 400);

    const email = `client-${Date.now()}@example.test`;
    const registerResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        cookie: csrfCookie
      },
      body: JSON.stringify({
        name: "Integration Client",
        email,
        password: "StrongPassword123",
        role: "client",
        city: "Lahore"
      })
    });
    assert.equal(registerResponse.status, 201);
    const registration = await registerResponse.json();
    assert.ok(registration.data.developmentVerificationToken);

    const verifyResponse = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        cookie: csrfCookie
      },
      body: JSON.stringify({
        token: registration.data.developmentVerificationToken
      })
    });
    assert.equal(verifyResponse.status, 200);
    const authCookies = cookiesFrom(verifyResponse);
    assert.match(authCookies, /ls_access=/);
    assert.match(authCookies, /ls_refresh=/);

    const meResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: authCookies }
    });
    assert.equal(meResponse.status, 200);
    const me = await meResponse.json();
    assert.equal(me.data.user.email, email);
    assert.equal(me.data.user.role, "client");
    assert.equal(me.data.user.passwordHash, undefined);
    assert.equal(me.data.user.tokenVersion, undefined);
  } catch (error) {
    error.message = `${error.message}\nServer logs:\n${logs}`;
    throw error;
  }
});
