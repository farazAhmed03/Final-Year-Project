const rateLimit = require("express-rate-limit");

const standard = {
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." }
  }
};

const apiLimiter = rateLimit({
  ...standard,
  windowMs: 15 * 60 * 1000,
  limit: 300
});

const authLimiter = rateLimit({
  ...standard,
  windowMs: 15 * 60 * 1000,
  limit: 12,
  skipSuccessfulRequests: false
});

const sensitiveLimiter = rateLimit({
  ...standard,
  windowMs: 60 * 60 * 1000,
  limit: 8
});

module.exports = { apiLimiter, authLimiter, sensitiveLimiter };
