const test = require("node:test");
const assert = require("node:assert/strict");
const { hashToken, timingSafeEqualStrings } = require("../utils/crypto");
const { rejectUnsafeKeys, cleanText } = require("../utils/text");
const { normalizeOrigin } = require("../config/env");

test("opaque token hashes are deterministic without exposing the token", () => {
  const token = "a-secret-token";
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), token);
});

test("timing safe string comparison checks equality", () => {
  assert.equal(timingSafeEqualStrings("same", "same"), true);
  assert.equal(timingSafeEqualStrings("same", "different"), false);
});

test("NoSQL operator keys are rejected recursively", () => {
  assert.throws(() => rejectUnsafeKeys({ profile: { $where: "evil" } }), /Unsafe key/);
  assert.doesNotThrow(() => rejectUnsafeKeys({ profile: { city: "Lahore" } }));
});

test("HTML is stripped from user text", () => {
  assert.equal(cleanText("<script>alert(1)</script>Hello"), "Hello");
});

test("CORS origins are normalized without accepting paths as part of the origin", () => {
  assert.equal(normalizeOrigin("http://localhost:8081/"), "http://localhost:8081");
  assert.equal(normalizeOrigin("http://127.0.0.1:8081/api"), "http://127.0.0.1:8081");
  assert.equal(normalizeOrigin("javascript:alert(1)"), "");
});
