const ApiError = require("../utils/ApiError");

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission for this action", "FORBIDDEN"));
    }
    next();
  };
}

function requireVerifiedEmail(req, _res, next) {
  if (!req.user?.emailVerified) {
    return next(new ApiError(403, "Verify your email before continuing", "EMAIL_NOT_VERIFIED"));
  }
  next();
}

module.exports = { requireRole, requireVerifiedEmail };
