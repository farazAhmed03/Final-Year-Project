const env = require("../config/env");

const accessCookie = "ls_access";
const refreshCookie = "ls_refresh";
const csrfCookie = "ls_csrf";

function baseCookie(httpOnly = true) {
  return {
    httpOnly,
    secure: env.cookieSecure,
    sameSite: "lax",
    domain: env.cookieDomain,
    path: "/"
  };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(accessCookie, accessToken, {
    ...baseCookie(true),
    maxAge: env.jwtAccessMaxAgeMs
  });
  res.cookie(refreshCookie, refreshToken, {
    ...baseCookie(true),
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookies(res) {
  res.clearCookie(accessCookie, baseCookie(true));
  res.clearCookie(refreshCookie, baseCookie(true));
}

module.exports = {
  accessCookie,
  refreshCookie,
  csrfCookie,
  baseCookie,
  setAuthCookies,
  clearAuthCookies
};
