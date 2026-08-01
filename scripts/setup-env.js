const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const examplePath = path.join(root, ".env.example");
const envPath = path.join(root, ".env");

function getArgument(name) {
  const exact = process.argv.find((item) => item.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function setValue(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
}

function getValue(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

function isWeak(value) {
  return !value || value.length < 32 || /^(change[_-]?me|faraz|secret|password)$/i.test(value);
}

if (!fs.existsSync(examplePath)) {
  throw new Error(".env.example was not found");
}

let content = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, "utf8")
  : fs.readFileSync(examplePath, "utf8");

const randomSecret = () => crypto.randomBytes(64).toString("base64url");
const randomPassword = () => crypto.randomBytes(18).toString("base64url");

let accessSecret = getValue(content, "JWT_ACCESS_SECRET");
const legacyJwt = getValue(content, "JWT_SECRET");
if (isWeak(accessSecret)) {
  accessSecret = !isWeak(legacyJwt) ? legacyJwt : randomSecret();
  content = setValue(content, "JWT_ACCESS_SECRET", accessSecret);
}
if (isWeak(legacyJwt)) {
  content = setValue(content, "JWT_SECRET", accessSecret);
}

const currentSessionSecret = getValue(content, "SESSION_SECRET");
if (isWeak(currentSessionSecret)) {
  content = setValue(content, "SESSION_SECRET", randomSecret());
}

const currentAdminPassword = getValue(content, "SEED_ADMIN_PASSWORD");
if (!currentAdminPassword || currentAdminPassword.length < 16 || /change[_-]?me/i.test(currentAdminPassword)) {
  content = setValue(content, "SEED_ADMIN_PASSWORD", randomPassword());
}

const requestedPort = getArgument("--frontend-port");
const frontendPort = requestedPort !== undefined
  ? Number.parseInt(requestedPort, 10)
  : Number.parseInt(getValue(content, "FRONTEND_PORT") || "8081", 10);

if (!Number.isInteger(frontendPort) || frontendPort < 1 || frontendPort > 65535) {
  throw new Error("--frontend-port/FRONTEND_PORT must be an integer between 1 and 65535");
}

const backendPort = Number.parseInt(getValue(content, "PORT") || "3000", 10);
if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const appUrl = `http://localhost:${frontendPort}`;
content = setValue(content, "PORT", String(backendPort));
content = setValue(content, "FRONTEND_PORT", String(frontendPort));
content = setValue(content, "APP_ORIGINS", `${appUrl},http://127.0.0.1:${frontendPort}`);
content = setValue(content, "PUBLIC_APP_URL", appUrl);
content = setValue(content, "BASE_URL_PASSWORD_RESET", appUrl);
content = setValue(content, "PRIVATE_UPLOAD_DIR", "/data/uploads");

const mailHost = getValue(content, "SMTP_HOST") || getValue(content, "MAIL_HOST");
if (/(^|\.)smtp\.gmail\.com$/i.test(mailHost)) {
  if (!getValue(content, "SMTP_PORT") && !getValue(content, "MAIL_PORT")) {
    content = setValue(content, "MAIL_PORT", "465");
  }
  if (!getValue(content, "SMTP_SECURE") && !getValue(content, "MAIL_SECURE")) {
    content = setValue(content, "MAIL_SECURE", "true");
  }
}

fs.writeFileSync(envPath, content, { mode: 0o600 });
console.log(`Created/updated ${envPath}`);
console.log(`LegalSphere frontend: ${appUrl}`);
console.log(`Backend container port: ${backendPort}`);
console.log("Legacy variable names were preserved; weak JWT/session placeholders were replaced.");
console.log("Run `node scripts/doctor.js` before starting Docker.");
