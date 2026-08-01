const path = require("path");
require("dotenv").config({ path: process.env.ENV_FILE || path.resolve(process.cwd(), "../.env") });

function bool(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function integer(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function durationMs(value, fallback) {
  const match = String(value || "").match(/^(\d+)(s|m|h|d)$/);
  if (!match) return fallback;
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * units[match[2]];
}

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value).trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.origin;
  } catch {
    return "";
  }
}

const legacyResetUrl = process.env.BASE_URL_PASSWORD_RESET || "";
const jwtAccessSecret =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  "development-only-secret-change-me";

const appOrigins = (process.env.APP_ORIGINS || "http://localhost:8081")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const publicAppUrl =
  normalizeOrigin(process.env.PUBLIC_APP_URL) ||
  normalizeOrigin(legacyResetUrl) ||
  "http://localhost:8081";

const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST || "";
const smtpPort = integer(
  process.env.SMTP_PORT || process.env.MAIL_PORT,
  /(^|\.)smtp\.gmail\.com$/i.test(smtpHost) ? 465 : 1025
);
const smtpSecure = bool(
  process.env.SMTP_SECURE || process.env.MAIL_SECURE,
  smtpPort === 465
);

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  port: integer(process.env.PORT, 3000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/legalsphere",
  appOrigins: [...new Set(appOrigins)],
  publicAppUrl,
  jwtAccessSecret,
  legacyJwtSecret: process.env.JWT_SECRET || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || "15m",
  jwtAccessMaxAgeMs: durationMs(process.env.JWT_ACCESS_TTL || "15m", 15 * 60 * 1000),
  refreshTokenTtlDays: integer(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
  cookieSecure: bool(process.env.COOKIE_SECURE, false),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  smtp: {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: process.env.SMTP_USER || process.env.MAIL_USER || "",
    pass: process.env.SMTP_PASS || process.env.MAIL_PASS || "",
    from: process.env.MAIL_FROM || "LegalSphere <no-reply@legalsphere.local>"
  },
  uploadDir: path.resolve(
    process.env.PRIVATE_UPLOAD_DIR ||
    process.env.LOCAL_UPLOAD_PATH ||
    path.join(process.cwd(), "private_uploads")
  ),
  maxFileSizeMb: integer(process.env.MAX_FILE_SIZE_MB, 10),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    url: process.env.CLOUDINARY_URL || ""
  },
  payfast: {
    merchantId: process.env.MERCHANT_ID || "",
    merchantKey: process.env.MERCHANT_KEY || "",
    processUrl: process.env.PAYFAST_URL || "",
    returnUrl: process.env.RETURN_URL || "",
    cancelUrl: process.env.CANCEL_URL || ""
  },
  stripePublicKey: process.env.STRIPE_PUBLIC_KEY || "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripeCurrency: process.env.STRIPE_CURRENCY || "usd",
  sentryDsn: process.env.SENTRY_DSN || "",
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "",
  exposeDevTokens: bool(process.env.EXPOSE_DEV_TOKENS, false),
  normalizeOrigin
});

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

if (env.nodeEnv === "production") {
  const missing = [];
  if (!process.env.MONGO_URI) missing.push("MONGO_URI");
  if (!process.env.APP_ORIGINS) missing.push("APP_ORIGINS");
  if (!process.env.PUBLIC_APP_URL && !process.env.BASE_URL_PASSWORD_RESET) {
    missing.push("PUBLIC_APP_URL");
  }
  if (!process.env.JWT_ACCESS_SECRET && !process.env.JWT_SECRET) {
    missing.push("JWT_ACCESS_SECRET or JWT_SECRET");
  }
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
  if (!env.appOrigins.length) {
    throw new Error("APP_ORIGINS must contain at least one valid http(s) origin");
  }
  if (env.jwtAccessSecret.length < 32 || /change[_-]?me/i.test(env.jwtAccessSecret)) {
    throw new Error("JWT access secret must be a random value of at least 32 characters");
  }
}

module.exports = env;
