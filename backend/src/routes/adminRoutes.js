const express = require("express");
const Joi = require("joi");
const User = require("../models/User");
const Session = require("../models/Session");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/authorize");
const { pagination, pageResult } = require("../utils/pagination");
const { cleanText } = require("../utils/text");
const {
  ROLES,
  USER_STATUS,
  LAWYER_VERIFICATION
} = require("../constants");

const router = express.Router();
router.use(authenticate, requireRole(ROLES.ADMIN));

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get(
  "/users",
  validate(Joi.object({
    search: Joi.string().trim().max(100).allow(""),
    role: Joi.string().valid(...Object.values(ROLES)),
    status: Joi.string().valid(...Object.values(USER_STATUS)),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(25)
  }), "query"),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query, { limit: 25, maxLimit: 100 });
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ name: regex }, { email: regex }, { city: regex }];
    }

    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter)
    ]);
    res.json({ success: true, data: pageResult(items, total, page, limit) });
  })
);

router.patch(
  "/users/:id/status",
  validate(Joi.object({ status: Joi.string().valid(...Object.values(USER_STATUS)).required() })),
  asyncHandler(async (req, res) => {
    if (String(req.user._id) === req.params.id && req.body.status === USER_STATUS.SUSPENDED) {
      throw new ApiError(400, "You cannot suspend your own account", "SELF_SUSPEND_DENIED");
    }

    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

    user.status = req.body.status;
    if (req.body.status === USER_STATUS.SUSPENDED) {
      user.tokenVersion += 1;
      await Session.deleteMany({ user: user._id });
    }
    await user.save();

    if (req.body.status === USER_STATUS.SUSPENDED) {
      req.io?.to(`user:${user.id}`).emit("account:updated", { status: USER_STATUS.SUSPENDED });
      req.io?.in(`user:${user.id}`).disconnectSockets(true);
    }

    res.json({ success: true, data: { user: user.toSafeObject() } });
  })
);

router.get(
  "/lawyers/pending",
  asyncHandler(async (_req, res) => {
    const items = await User.find({
      role: ROLES.LAWYER,
      emailVerified: true,
      "lawyerProfile.verificationStatus": LAWYER_VERIFICATION.PENDING
    }).sort({ createdAt: 1 });

    res.json({ success: true, data: { items } });
  })
);

router.patch(
  "/lawyers/:id/verification",
  validate(Joi.object({
    status: Joi.string().valid(
      LAWYER_VERIFICATION.APPROVED,
      LAWYER_VERIFICATION.REJECTED,
      LAWYER_VERIFICATION.PENDING
    ).required(),
    note: Joi.string().trim().max(500).allow("")
  })),
  asyncHandler(async (req, res) => {
    const lawyer = await User.findOne({ _id: req.params.id, role: ROLES.LAWYER });
    if (!lawyer) throw new ApiError(404, "Lawyer not found", "LAWYER_NOT_FOUND");

    lawyer.lawyerProfile ||= {};
    if (
      req.body.status === LAWYER_VERIFICATION.APPROVED
      && (!lawyer.lawyerProfile.licenseNumber || !lawyer.lawyerProfile.specialization)
    ) {
      throw new ApiError(
        409,
        "License number and specialization are required before approval",
        "LAWYER_PROFILE_INCOMPLETE"
      );
    }
    lawyer.lawyerProfile.verificationStatus = req.body.status;
    lawyer.lawyerProfile.verificationNote = cleanText(req.body.note, 500);
    await lawyer.save();

    req.io?.to(`user:${lawyer.id}`).emit("account:updated", {
      verificationStatus: req.body.status
    });

    res.json({ success: true, data: { lawyer: lawyer.toSafeObject() } });
  })
);

module.exports = router;
