const express = require("express");
const Joi = require("joi");
const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { pagination, pageResult } = require("../utils/pagination");
const ApiError = require("../utils/ApiError");

const router = express.Router();
router.use(authenticate);

router.get(
  "/",
  validate(Joi.object({
    unreadOnly: Joi.boolean().default(false),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20)
  }), "query"),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query);
    const filter = { user: req.user._id };
    if (req.query.unreadOnly) filter.readAt = null;

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, readAt: null })
    ]);

    res.json({
      success: true,
      data: { ...pageResult(items, total, page, limit), unreadCount }
    });
  })
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, readAt: null }, { readAt: new Date() });
    res.status(204).send();
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const item = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { readAt: new Date() },
      { new: true }
    );
    if (!item) throw new ApiError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");
    res.json({ success: true, data: { notification: item } });
  })
);

module.exports = router;
