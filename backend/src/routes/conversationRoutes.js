const express = require("express");
const Joi = require("joi");
const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const Case = require("../models/Case");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { requireVerifiedEmail } = require("../middleware/authorize");
const { pagination, pageResult } = require("../utils/pagination");
const { assertParticipant, sendMessage } = require("../services/messageService");

const router = express.Router();
router.use(authenticate, requireVerifiedEmail);

function participantKey(left, right, caseId) {
  return `${[String(left), String(right)].sort().join(":")}:${caseId || "general"}`;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate("participants", "name role avatarUrl lawyerProfile.specialization")
      .populate("case", "title status")
      .sort({ lastMessageAt: -1 })
      .limit(100);

    const unread = await Message.aggregate([
      {
        $match: {
          conversation: { $in: conversations.map((item) => item._id) },
          sender: { $ne: req.user._id },
          readBy: { $ne: req.user._id }
        }
      },
      { $group: { _id: "$conversation", count: { $sum: 1 } } }
    ]);
    const unreadMap = new Map(unread.map((item) => [String(item._id), item.count]));

    res.json({
      success: true,
      data: {
        items: conversations.map((item) => ({
          ...item.toObject(),
          unreadCount: unreadMap.get(String(item._id)) || 0
        }))
      }
    });
  })
);

router.post(
  "/",
  validate(Joi.object({
    userId: Joi.string().hex().length(24).required(),
    caseId: Joi.string().hex().length(24).allow("", null)
  })),
  asyncHandler(async (req, res) => {
    if (req.body.userId === String(req.user._id)) {
      throw new ApiError(400, "You cannot create a conversation with yourself", "INVALID_PARTICIPANT");
    }

    const target = await User.findOne({ _id: req.body.userId, status: "active", emailVerified: true });
    if (!target) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

    if (target.role === req.user.role && req.user.role !== "admin") {
      throw new ApiError(403, "Conversations must be between a client and lawyer", "INVALID_PARTICIPANT");
    }

    let linkedCase;
    if (req.body.caseId) {
      linkedCase = await Case.findOne({
        _id: req.body.caseId,
        client: { $in: [req.user._id, target._id] },
        lawyer: { $in: [req.user._id, target._id] }
      });
      if (!linkedCase) throw new ApiError(403, "Case does not belong to these participants", "INVALID_CASE");
    }

    const key = participantKey(req.user._id, target._id, linkedCase?._id);
    const conversation = await Conversation.findOneAndUpdate(
      { participantKey: key },
      {
        $setOnInsert: {
          participants: [req.user._id, target._id],
          participantKey: key,
          case: linkedCase?._id
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await conversation.populate("participants", "name role avatarUrl lawyerProfile.specialization");
    res.status(201).json({ success: true, data: { conversation } });
  })
);

router.get(
  "/:id/messages",
  validate(Joi.object({
    before: Joi.date().iso(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(40)
  }), "query"),
  asyncHandler(async (req, res) => {
    await assertParticipant(req.params.id, req.user._id);
    const { page, limit, skip } = pagination(req.query, { limit: 40, maxLimit: 100 });
    const filter = { conversation: req.params.id };
    if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };

    const [items, total] = await Promise.all([
      Message.find(filter)
        .populate("sender", "name role avatarUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: pageResult(items.reverse(), total, page, limit)
    });
  })
);

router.post(
  "/:id/messages",
  validate(Joi.object({ body: Joi.string().trim().min(1).max(4000).required() })),
  asyncHandler(async (req, res) => {
    const message = await sendMessage({
      io: req.io,
      conversationId: req.params.id,
      sender: req.user,
      body: req.body.body
    });
    res.status(201).json({ success: true, data: { message } });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await assertParticipant(req.params.id, req.user._id);
    await Message.updateMany(
      {
        conversation: req.params.id,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id }
      },
      { $addToSet: { readBy: req.user._id } }
    );

    req.io?.to(`conversation:${req.params.id}`).emit("message:read", {
      conversationId: req.params.id,
      userId: String(req.user._id)
    });

    res.status(204).send();
  })
);

module.exports = router;
