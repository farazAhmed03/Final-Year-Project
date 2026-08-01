const ApiError = require("../utils/ApiError");
const { randomToken, timingSafeEqualStrings } = require("../utils/crypto");
const { csrfCookie, baseCookie } = require("../utils/cookies");

function issueCsrfToken(_req, res) {
  const token = randomToken(32);
  res.cookie(csrfCookie, token, {
    ...baseCookie(false),
    maxAge: 24 * 60 * 60 * 1000
  });
  return token;
}

function csrfProtection(req, _res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const cookieToken = req.cookies?.[csrfCookie];
  const headerToken = req.get("x-csrf-token");

  if (!cookieToken || !headerToken || !timingSafeEqualStrings(cookieToken, headerToken)) {
    return next(new ApiError(403, "Invalid CSRF token", "CSRF_INVALID"));
  }

  next();
}

module.exports = { issueCsrfToken, csrfProtection };
