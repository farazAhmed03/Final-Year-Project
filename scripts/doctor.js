const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

function parseEnv(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

function normalizedOrigin(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.origin : "";
  } catch {
    return "";
  }
}

function validPort(value) {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

if (!fs.existsSync(envPath)) {
  console.error("ERROR: .env is missing. Copy your legacy env to .env, then run `node scripts/setup-env.js --frontend-port 8081`.");
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const errors = [];
const warnings = [];

for (const key of ["MONGO_URI", "APP_ORIGINS", "PUBLIC_APP_URL"]) {
  if (!env[key]) errors.push(`${key} is missing`);
}

if (!validPort(env.PORT || "3000")) errors.push("PORT must be between 1 and 65535");
if (!validPort(env.FRONTEND_PORT || "8081")) errors.push("FRONTEND_PORT must be between 1 and 65535");

const frontendPort = Number.parseInt(env.FRONTEND_PORT || "8081", 10);
const origins = (env.APP_ORIGINS || "")
  .split(",")
  .map((value) => normalizedOrigin(value.trim()))
  .filter(Boolean);

if (!origins.length) errors.push("APP_ORIGINS contains no valid http(s) origins");

const expectedOrigins = [
  `http://localhost:${frontendPort}`,
  `http://127.0.0.1:${frontendPort}`
];
if (!expectedOrigins.some((origin) => origins.includes(origin))) {
  errors.push(`APP_ORIGINS must include the configured frontend port ${frontendPort}`);
}

const publicOrigin = normalizedOrigin(env.PUBLIC_APP_URL || "");
if (!publicOrigin) {
  errors.push("PUBLIC_APP_URL is invalid");
} else if (!origins.includes(publicOrigin)) {
  warnings.push("PUBLIC_APP_URL is not included in APP_ORIGINS");
}

const jwt = env.JWT_ACCESS_SECRET || env.JWT_SECRET || "";
if (jwt.length < 32 || /^(faraz|secret|password|change[_-]?me)$/i.test(jwt)) {
  errors.push("JWT_ACCESS_SECRET/JWT_SECRET must be a random value of at least 32 characters");
}

if ((env.PRIVATE_UPLOAD_DIR || "") !== "/data/uploads") {
  warnings.push("PRIVATE_UPLOAD_DIR should be /data/uploads for the supplied Docker volume");
}

const mailHost = env.SMTP_HOST || env.MAIL_HOST || "";
const mailPort = env.SMTP_PORT || env.MAIL_PORT || "";
const mailSecure = env.SMTP_SECURE || env.MAIL_SECURE || "";
if (/(^|\.)smtp\.gmail\.com$/i.test(mailHost)) {
  if (!["465", "587"].includes(mailPort)) {
    warnings.push("Gmail SMTP should normally use port 465 or 587");
  }
  if (mailPort === "465" && mailSecure !== "true") {
    warnings.push("Gmail port 465 requires MAIL_SECURE/SMTP_SECURE=true");
  }
}

if (env.NODE_ENV === "production" && env.COOKIE_SECURE !== "true") {
  warnings.push("COOKIE_SECURE=false is acceptable only for local HTTP, not a public production deployment");
}

if ((env.STRIPE_SECRET_KEY || "") && !(env.STRIPE_WEBHOOK_SECRET || "")) {
  warnings.push("STRIPE_WEBHOOK_SECRET is missing; checkout can start but payment confirmation remains disabled");
}

if ((env.MERCHANT_ID || "") || (env.MERCHANT_KEY || "")) {
  warnings.push("PayFast legacy variables are loaded for compatibility, but this rebuild currently uses Stripe Checkout");
}

if ((env.CLOUDINARY_API_SECRET || "") || (env.CLOUDINARY_URL || "")) {
  warnings.push("Cloudinary variables are reserved for profile media; private legal files use /data/uploads");
}

for (const file of ["backend/package-lock.json", "frontend/package-lock.json"]) {
  const fullPath = path.join(root, file);
  if (
    fs.existsSync(fullPath) &&
    fs.readFileSync(fullPath, "utf8").includes("applied-caas-gateway")
  ) {
    errors.push(`${file} contains an inaccessible internal package registry URL`);
  }
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);

if (errors.length) process.exit(1);
console.log(`Environment looks valid. LegalSphere URL: http://localhost:${frontendPort}`);
