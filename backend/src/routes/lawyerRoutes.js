const express = require("express");
const Joi = require("joi");
const mongoose = require("mongoose");
const User = require("../models/User");
const Review = require("../models/Review");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { pagination, pageResult } = require("../utils/pagination");
const { ROLES, LAWYER_VERIFICATION, USER_STATUS } = require("../constants");

const router = express.Router();

const querySchema = Joi.object({
  search: Joi.string().trim().max(100).allow(""),
  specialization: Joi.string().trim().max(100).allow(""),
  city: Joi.string().trim().max(100).allow(""),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(12)
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get(
  "/",
  validate(querySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query, { limit: 12, maxLimit: 50 });
    const filter = {
      role: ROLES.LAWYER,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      "lawyerProfile.verificationStatus": LAWYER_VERIFICATION.APPROVED
    };

    if (req.query.specialization) {
      filter["lawyerProfile.specialization"] = new RegExp(escapeRegex(req.query.specialization), "i");
    }
    if (req.query.city) {
      filter.city = new RegExp(escapeRegex(req.query.city), "i");
    }
    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [
        { name: regex },
        { city: regex },
        { "lawyerProfile.specialization": regex },
        { "lawyerProfile.bio": regex }
      ];
    }

    const [lawyers, total] = await Promise.all([
      User.find(filter)
        .select("name city avatarUrl lawyerProfile createdAt")
        .sort({ "lawyerProfile.experienceYears": -1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    const ids = lawyers.map((lawyer) => lawyer._id);
    const ratings = await Review.aggregate([
      { $match: { lawyer: { $in: ids } } },
      { $group: { _id: "$lawyer", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } }
    ]);
    const ratingMap = new Map(ratings.map((item) => [String(item._id), item]));

    const items = lawyers.map((lawyer) => ({
      ...lawyer,
      averageRating: Number((ratingMap.get(String(lawyer._id))?.averageRating || 0).toFixed(1)),
      reviewCount: ratingMap.get(String(lawyer._id))?.reviewCount || 0
    }));

    res.json({ success: true, data: pageResult(items, total, page, limit) });
  })
);

router.get(
  "/specializations",
  asyncHandler(async (_req, res) => {
    const items = await User.distinct("lawyerProfile.specialization", {
      role: ROLES.LAWYER,
      "lawyerProfile.verificationStatus": LAWYER_VERIFICATION.APPROVED
    });
    res.json({ success: true, data: { items: items.filter(Boolean).sort() } });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new ApiError(400, "Invalid lawyer ID", "INVALID_ID");
    }

    const lawyer = await User.findOne({
      _id: req.params.id,
      role: ROLES.LAWYER,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      "lawyerProfile.verificationStatus": LAWYER_VERIFICATION.APPROVED
    }).select("name city avatarUrl lawyerProfile createdAt").lean();

    if (!lawyer) throw new ApiError(404, "Lawyer not found", "LAWYER_NOT_FOUND");

    const [summary] = await Review.aggregate([
      { $match: { lawyer: lawyer._id } },
      { $group: { _id: "$lawyer", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        lawyer: {
          ...lawyer,
          averageRating: Number((summary?.averageRating || 0).toFixed(1)),
          reviewCount: summary?.reviewCount || 0
        }
      }
    });
  })
);

module.exports = router;
