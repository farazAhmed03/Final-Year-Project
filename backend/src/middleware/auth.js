const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { accessCookie } = require("../utils/cookies");
const { USER_STATUS } = require("../constants");

async function authenticate(req, _res, next) {
  try {
    const bearer = req.get("authorization");
    const token = req.cookies?.[accessCookie]
      || (bearer?.startsWith("Bearer ") ? bearer.slice(7) : null);

    if (!token) {
      throw new ApiError(401, "Authentication required", "AUTH_REQUIRED");
    }

    const payload = jwt.verify(token, env.jwtAccessSecret, {
      algorithms: ["HS256"],
      issuer: "legalsphere-api",
      audience: "legalsphere-web"
    });

    const user = await User.findById(payload.sub);
    if (!user || user.status !== USER_STATUS.ACTIVE || user.tokenVersion !== payload.ver) {
      throw new ApiError(401, "Session is no longer valid", "SESSION_INVALID");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(401, "Invalid or expired session", "SESSION_INVALID"));
  }
}

async function optionalAuthenticate(req, _res, next) {
  const token = req.cookies?.[accessCookie];
  if (!token) return next();
  return authenticate(req, _res, next);
}

module.exports = { authenticate, optionalAuthenticate };
