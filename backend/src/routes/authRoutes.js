const express = require("express");
const Joi = require("joi");
const User = require("../models/User");
const Session = require("../models/Session");
const OneTimeToken = require("../models/OneTimeToken");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { authLimiter, sensitiveLimiter } = require("../middleware/rateLimits");
const { issueCsrfToken } = require("../middleware/csrf");
const { randomToken, hashToken } = require("../utils/crypto");
const { cleanText } = require("../utils/text");
const {
  createAccessToken,
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession
} = require("../services/tokenService");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../services/mailService");
const { verifyFirebaseToken } = require("../services/firebaseService");
const {
  accessCookie,
  refreshCookie,
  setAuthCookies,
  clearAuthCookies
} = require("../utils/cookies");
const { ROLES, LAWYER_VERIFICATION } = require("../constants");
const env = require("../config/env");

const router = express.Router();

const password = Joi.string()
  .min(10)
  .max(128)
  .pattern(/[a-z]/, "lowercase")
  .pattern(/[A-Z]/, "uppercase")
  .pattern(/[0-9]/, "number")
  .required();

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  password,
  role: Joi.string().valid(ROLES.CLIENT, ROLES.LAWYER).default(ROLES.CLIENT),
  phone: Joi.string().trim().max(30).allow(""),
  city: Joi.string().trim().max(100).allow(""),
  licenseNumber: Joi.when("role", {
    is: ROLES.LAWYER,
    then: Joi.string().trim().min(3).max(100).required(),
    otherwise: Joi.forbidden()
  }),
  specialization: Joi.when("role", {
    is: ROLES.LAWYER,
    then: Joi.string().trim().min(2).max(100).required(),
    otherwise: Joi.forbidden()
  }),
  experienceYears: Joi.when("role", {
    is: ROLES.LAWYER,
    then: Joi.number().integer().min(0).max(80).default(0),
    otherwise: Joi.forbidden()
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().max(128).required()
});

const tokenSchema = Joi.object({
  token: Joi.string().min(20).max(500).required()
});

async function createOneTimeToken(user, purpose, ttlMinutes) {
  await OneTimeToken.deleteMany({ user: user._id, purpose, consumedAt: null });
  const token = randomToken(32);
  await OneTimeToken.create({
    user: user._id,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000)
  });
  return token;
}

async function establishSession(user, req, res) {
  const accessToken = createAccessToken(user);
  const refreshToken = await createRefreshSession(user, req);
  setAuthCookies(res, accessToken, refreshToken);
}

router.get("/csrf", (req, res) => {
  const token = issueCsrfToken(req, res);
  res.json({ success: true, data: { csrfToken: token } });
});

router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const existing = await User.findOne({ email: req.body.email }).lean();
    if (existing) {
      throw new ApiError(409, "An account with this email already exists", "EMAIL_IN_USE");
    }

    const lawyerProfile = req.body.role === ROLES.LAWYER
      ? {
          licenseNumber: cleanText(req.body.licenseNumber, 100),
          specialization: cleanText(req.body.specialization, 100),
          experienceYears: req.body.experienceYears,
          verificationStatus: LAWYER_VERIFICATION.PENDING
        }
      : undefined;

    const user = await User.create({
      name: cleanText(req.body.name, 100),
      email: req.body.email,
      passwordHash: req.body.password,
      role: req.body.role,
      phone: cleanText(req.body.phone, 30),
      city: cleanText(req.body.city, 100),
      lawyerProfile
    });

    const token = await createOneTimeToken(user, "verify_email", 30);
    await sendVerificationEmail(user, token);

    res.status(201).json({
      success: true,
      data: {
        message: "Account created. Check your email to verify it.",
        ...(env.exposeDevTokens ? { developmentVerificationToken: token } : {})
      }
    });
  })
);

router.post(
  "/verify-email",
  authLimiter,
  validate(tokenSchema),
  asyncHandler(async (req, res) => {
    const record = await OneTimeToken.findOneAndUpdate(
      {
        tokenHash: hashToken(req.body.token),
        purpose: "verify_email",
        consumedAt: null,
        expiresAt: { $gt: new Date() }
      },
      { $set: { consumedAt: new Date() } },
      { new: true }
    );

    if (!record) {
      throw new ApiError(400, "Verification link is invalid or expired", "TOKEN_INVALID");
    }

    const user = await User.findById(record.user);
    if (!user) throw new ApiError(404, "Account not found", "USER_NOT_FOUND");

    user.emailVerified = true;
    await user.save();
    await establishSession(user, req, res);

    res.json({
      success: true,
      data: {
        message: "Email verified successfully",
        user: user.toSafeObject()
      }
    });
  })
);

router.post(
  "/resend-verification",
  sensitiveLimiter,
  validate(Joi.object({ email: Joi.string().email().lowercase().required() })),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (user && !user.emailVerified) {
      const token = await createOneTimeToken(user, "verify_email", 30);
      await sendVerificationEmail(user, token);
    }

    res.json({
      success: true,
      data: { message: "If the account needs verification, a new email has been sent." }
    });
  })
);

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select("+passwordHash");
    const valid = user ? await user.verifyPassword(req.body.password) : false;

    if (!valid) {
      throw new ApiError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }
    if (!user.emailVerified) {
      throw new ApiError(403, "Verify your email before signing in", "EMAIL_NOT_VERIFIED");
    }
    if (user.status !== "active") {
      throw new ApiError(403, "This account is suspended", "ACCOUNT_SUSPENDED");
    }

    user.lastLoginAt = new Date();
    await user.save();
    await establishSession(user, req, res);

    res.json({ success: true, data: { user: user.toSafeObject() } });
  })
);

router.post(
  "/google",
  authLimiter,
  validate(Joi.object({
    idToken: Joi.string().min(50).required(),
    role: Joi.string().valid(ROLES.CLIENT, ROLES.LAWYER).default(ROLES.CLIENT)
  })),
  asyncHandler(async (req, res) => {
    const decoded = await verifyFirebaseToken(req.body.idToken);
    if (!decoded.email || !decoded.email_verified) {
      throw new ApiError(400, "Google account email is not verified", "GOOGLE_EMAIL_NOT_VERIFIED");
    }

    let user = await User.findOne({
      $or: [{ firebaseUid: decoded.uid }, { email: decoded.email.toLowerCase() }]
    });

    if (!user) {
      user = await User.create({
        name: cleanText(decoded.name || decoded.email.split("@")[0], 100),
        email: decoded.email.toLowerCase(),
        role: req.body.role,
        emailVerified: true,
        authProvider: "firebase",
        firebaseUid: decoded.uid,
        avatarUrl: decoded.picture,
        lawyerProfile: req.body.role === ROLES.LAWYER
          ? { verificationStatus: LAWYER_VERIFICATION.PENDING }
          : undefined
      });
    } else {
      user.firebaseUid ||= decoded.uid;
      user.emailVerified = true;
      await user.save();
    }

    if (user.status !== "active") {
      throw new ApiError(403, "This account is suspended", "ACCOUNT_SUSPENDED");
    }

    await establishSession(user, req, res);
    res.json({ success: true, data: { user: user.toSafeObject() } });
  })
);

router.post(
  "/refresh",
  authLimiter,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[refreshCookie];
    if (!refreshToken) {
      throw new ApiError(401, "Refresh session is missing", "REFRESH_REQUIRED");
    }

    const rotated = await rotateRefreshSession(refreshToken, req);
    if (!rotated || rotated.user.status !== "active") {
      clearAuthCookies(res);
      throw new ApiError(401, "Refresh session is invalid or expired", "REFRESH_INVALID");
    }

    setAuthCookies(res, createAccessToken(rotated.user), rotated.refreshToken);
    res.json({ success: true, data: { user: rotated.user.toSafeObject() } });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await revokeRefreshSession(req.cookies?.[refreshCookie]);
    clearAuthCookies(res);
    res.status(204).send();
  })
);

router.post(
  "/forgot-password",
  sensitiveLimiter,
  validate(Joi.object({ email: Joi.string().email().lowercase().required() })),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (user && user.authProvider === "local") {
      const token = await createOneTimeToken(user, "reset_password", 20);
      await sendPasswordResetEmail(user, token);
    }

    res.json({
      success: true,
      data: { message: "If this account exists, a password reset email has been sent." }
    });
  })
);

router.post(
  "/reset-password",
  sensitiveLimiter,
  validate(Joi.object({ token: Joi.string().min(20).required(), password })),
  asyncHandler(async (req, res) => {
    const record = await OneTimeToken.findOneAndUpdate(
      {
        tokenHash: hashToken(req.body.token),
        purpose: "reset_password",
        consumedAt: null,
        expiresAt: { $gt: new Date() }
      },
      { $set: { consumedAt: new Date() } },
      { new: true }
    );

    if (!record) {
      throw new ApiError(400, "Password reset link is invalid or expired", "TOKEN_INVALID");
    }

    const user = await User.findById(record.user);
    if (!user) throw new ApiError(404, "Account not found", "USER_NOT_FOUND");

    user.passwordHash = req.body.password;
    user.tokenVersion += 1;
    await Promise.all([
      user.save(),
      Session.deleteMany({ user: user._id })
    ]);

    req.io?.in(`user:${user.id}`).disconnectSockets(true);
    clearAuthCookies(res);
    res.json({ success: true, data: { message: "Password changed. Sign in with your new password." } });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { user: req.user.toSafeObject() } });
  })
);

router.patch(
  "/profile",
  authenticate,
  validate(Joi.object({
    name: Joi.string().trim().min(2).max(100),
    phone: Joi.string().trim().max(30).allow(""),
    city: Joi.string().trim().max(100).allow(""),
    avatarUrl: Joi.string().uri().max(1000).allow(""),
    bio: Joi.string().trim().max(3000).allow(""),
    specialization: Joi.string().trim().max(100).allow(""),
    experienceYears: Joi.number().integer().min(0).max(80),
    hourlyRate: Joi.number().min(0).max(10000000)
  }).min(1)),
  asyncHandler(async (req, res) => {
    const direct = ["name", "phone", "city", "avatarUrl"];
    for (const key of direct) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        req.user[key] = typeof req.body[key] === "string" ? cleanText(req.body[key], 1000) : req.body[key];
      }
    }

    if (req.user.role === ROLES.LAWYER) {
      req.user.lawyerProfile ||= {};
      for (const key of ["bio", "specialization", "experienceYears", "hourlyRate"]) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          req.user.lawyerProfile[key] = typeof req.body[key] === "string"
            ? cleanText(req.body[key], key === "bio" ? 3000 : 100)
            : req.body[key];
        }
      }
    }

    await req.user.save();
    res.json({ success: true, data: { user: req.user.toSafeObject() } });
  })
);

router.post(
  "/change-password",
  authenticate,
  sensitiveLimiter,
  validate(Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: password
  })),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("+passwordHash");
    const valid = await user.verifyPassword(req.body.currentPassword);
    if (!valid) throw new ApiError(400, "Current password is incorrect", "PASSWORD_INCORRECT");

    user.passwordHash = req.body.newPassword;
    user.tokenVersion += 1;
    await Promise.all([user.save(), Session.deleteMany({ user: user._id })]);
    req.io?.in(`user:${user.id}`).disconnectSockets(true);
    clearAuthCookies(res);

    res.json({ success: true, data: { message: "Password changed. Please sign in again." } });
  })
);

module.exports = router;
