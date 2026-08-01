const express = require("express");
const Joi = require("joi");
const mongoose = require("mongoose");
const Review = require("../models/Review");
const Case = require("../models/Case");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { requireRole, requireVerifiedEmail } = require("../middleware/authorize");
const { cleanText } = require("../utils/text");
const { pagination, pageResult } = require("../utils/pagination");
const { createNotification } = require("../services/notificationService");
const { ROLES, CASE_STATUS } = require("../constants");

const router = express.Router();

router.get(
  "/lawyers/:lawyerId",
  validate(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }), "query"),
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.lawyerId)) {
      throw new ApiError(400, "Invalid lawyer ID", "INVALID_ID");
    }
    const { page, limit, skip } = pagination(req.query, { limit: 10, maxLimit: 50 });
    const filter = { lawyer: req.params.lawyerId };

    const [items, total, summary] = await Promise.all([
      Review.find(filter)
        .populate("client", "name avatarUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter),
      Review.aggregate([
        { $match: { lawyer: new mongoose.Types.ObjectId(req.params.lawyerId) } },
        { $group: { _id: "$lawyer", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        ...pageResult(items, total, page, limit),
        averageRating: Number((summary[0]?.averageRating || 0).toFixed(1)),
        reviewCount: summary[0]?.reviewCount || 0
      }
    });
  })
);


router.get(
  "/cases/:caseId",
  authenticate,
  asyncHandler(async (req, res) => {
    const item = await Case.findById(req.params.caseId);
    if (!item) throw new ApiError(404, "Case not found", "CASE_NOT_FOUND");

    const allowed = req.user.role === ROLES.ADMIN
      || item.client.equals(req.user._id)
      || item.lawyer.equals(req.user._id);
    if (!allowed) throw new ApiError(403, "You cannot access this review", "FORBIDDEN");

    const review = await Review.findOne({ case: item._id }).populate("client", "name avatarUrl");
    if (!review) throw new ApiError(404, "Review not found", "REVIEW_NOT_FOUND");

    res.json({ success: true, data: { review } });
  })
);

router.post(
  "/",
  authenticate,
  requireVerifiedEmail,
  requireRole(ROLES.CLIENT),
  validate(Joi.object({
    caseId: Joi.string().hex().length(24).required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().trim().max(2000).allow("")
  })),
  asyncHandler(async (req, res) => {
    const item = await Case.findOne({
      _id: req.body.caseId,
      client: req.user._id,
      status: CASE_STATUS.CLOSED
    });
    if (!item) {
      throw new ApiError(400, "Only your closed case can be reviewed", "CASE_NOT_REVIEWABLE");
    }

    const review = await Review.create({
      case: item._id,
      client: req.user._id,
      lawyer: item.lawyer,
      rating: req.body.rating,
      comment: cleanText(req.body.comment, 2000)
    });

    await createNotification(req.io, {
      user: item.lawyer,
      type: "review",
      title: "New client review",
      message: `${req.user.name} left a ${review.rating}-star review.`,
      link: `/lawyers/${item.lawyer}`
    });

    await review.populate("client", "name avatarUrl");
    res.status(201).json({ success: true, data: { review } });
  })
);

router.patch(
  "/:id",
  authenticate,
  requireRole(ROLES.CLIENT),
  validate(Joi.object({
    rating: Joi.number().integer().min(1).max(5),
    comment: Joi.string().trim().max(2000).allow("")
  }).min(1)),
  asyncHandler(async (req, res) => {
    const review = await Review.findOne({ _id: req.params.id, client: req.user._id });
    if (!review) throw new ApiError(404, "Review not found", "REVIEW_NOT_FOUND");

    if (req.body.rating) review.rating = req.body.rating;
    if (Object.prototype.hasOwnProperty.call(req.body, "comment")) {
      review.comment = cleanText(req.body.comment, 2000);
    }
    await review.save();

    res.json({ success: true, data: { review } });
  })
);

module.exports = router;
