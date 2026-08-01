const jwt = require("jsonwebtoken");
const env = require("../config/env");
const Session = require("../models/Session");
const { USER_STATUS } = require("../constants");
const { randomToken, hashToken } = require("../utils/crypto");

function createAccessToken(user) {
  return jwt.sign(
    { role: user.role, ver: user.tokenVersion },
    env.jwtAccessSecret,
    {
      subject: user.id,
      expiresIn: env.jwtAccessTtl,
      algorithm: "HS256",
      issuer: "legalsphere-api",
      audience: "legalsphere-web"
    }
  );
}

async function createRefreshSession(user, req) {
  const token = randomToken(48);
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  await Session.create({
    user: user._id,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: req.get("user-agent")?.slice(0, 500),
    ip: req.ip
  });
  return token;
}

async function rotateRefreshSession(refreshToken, req) {
  const tokenHash = hashToken(refreshToken);
  const session = await Session.findOneAndDelete({
    tokenHash,
    expiresAt: { $gt: new Date() }
  }).populate("user");

  if (!session?.user || session.user.status !== USER_STATUS.ACTIVE) return null;

  const newToken = await createRefreshSession(session.user, req);
  return { user: session.user, refreshToken: newToken };
}

async function revokeRefreshSession(refreshToken) {
  if (!refreshToken) return;
  await Session.deleteOne({ tokenHash: hashToken(refreshToken) });
}

module.exports = {
  createAccessToken,
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession
};
