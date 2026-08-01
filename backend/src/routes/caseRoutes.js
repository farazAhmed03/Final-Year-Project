const express = require("express");
const Joi = require("joi");
const mongoose = require("mongoose");
const Case = require("../models/Case");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { requireRole, requireVerifiedEmail } = require("../middleware/authorize");
const { upload } = require("../middleware/upload");
const { pagination, pageResult } = require("../utils/pagination");
const { cleanText } = require("../utils/text");
const {
  persistTempFile,
  safePath,
  deleteStoredFile,
  cleanupTempFiles
} = require("../services/fileService");
const { createNotification } = require("../services/notificationService");
const { ROLES, CASE_STATUS, LAWYER_VERIFICATION } = require("../constants");
const { caseTransitions, canTransition } = require("../utils/transitions");

const router = express.Router();
router.use(authenticate, requireVerifiedEmail);

function canAccessCase(item, user) {
  return user.role === ROLES.ADMIN
    || item.client.equals(user._id)
    || item.lawyer.equals(user._id);
}

const createSchema = Joi.object({
  lawyerId: Joi.string().hex().length(24).required(),
  appointmentId: Joi.string().hex().length(24).allow("", null),
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().min(10).max(10000).required(),
  category: Joi.string().trim().min(2).max(100).required()
});

router.post(
  "/",
  requireRole(ROLES.CLIENT),
  upload.array("documents", 5),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const tempFiles = req.files || [];
    const stored = [];

    try {
      const lawyer = await User.findOne({
        _id: req.body.lawyerId,
        role: ROLES.LAWYER,
        status: "active",
        emailVerified: true,
        "lawyerProfile.verificationStatus": LAWYER_VERIFICATION.APPROVED
      });
      if (!lawyer) throw new ApiError(404, "Approved lawyer not found", "LAWYER_NOT_FOUND");

      let appointment;
      if (req.body.appointmentId) {
        appointment = await Appointment.findOne({
          _id: req.body.appointmentId,
          client: req.user._id,
          lawyer: lawyer._id,
          status: { $in: ["confirmed", "completed"] }
        });
        if (!appointment) {
          throw new ApiError(400, "Appointment is not valid for this case", "INVALID_APPOINTMENT");
        }
        if (await Case.exists({ appointment: appointment._id })) {
          throw new ApiError(409, "A case already exists for this appointment", "CASE_ALREADY_EXISTS");
        }
      }

      for (const file of tempFiles) {
        const document = await persistTempFile(file);
        stored.push({ ...document, uploadedBy: req.user._id });
      }

      const item = await Case.create({
        title: cleanText(req.body.title, 200),
        description: cleanText(req.body.description, 10000),
        category: cleanText(req.body.category, 100),
        client: req.user._id,
        lawyer: lawyer._id,
        appointment: appointment?._id,
        documents: stored,
        timeline: [{
          status: CASE_STATUS.SUBMITTED,
          note: "Case submitted by client",
          actor: req.user._id
        }]
      });

      await createNotification(req.io, {
        user: lawyer._id,
        type: "case",
        title: "New case submitted",
        message: `${req.user.name} submitted “${item.title}”.`,
        link: `/app/cases/${item.id}`
      });

      await item.populate([
        { path: "client", select: "name email avatarUrl" },
        { path: "lawyer", select: "name email avatarUrl lawyerProfile.specialization" }
      ]);

      res.status(201).json({ success: true, data: { case: item } });
    } catch (error) {
      await Promise.all(stored.map((file) => deleteStoredFile(file.storageKey)));
      await cleanupTempFiles(tempFiles);
      throw error;
    }
  })
);

router.get(
  "/",
  validate(Joi.object({
    status: Joi.string().valid(...Object.values(CASE_STATUS)),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20)
  }), "query"),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query);
    const filter = {};
    if (req.user.role === ROLES.CLIENT) filter.client = req.user._id;
    if (req.user.role === ROLES.LAWYER) filter.lawyer = req.user._id;
    if (req.query.status) filter.status = req.query.status;

    const [items, total] = await Promise.all([
      Case.find(filter)
        .populate("client", "name email avatarUrl")
        .populate("lawyer", "name email avatarUrl lawyerProfile.specialization")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Case.countDocuments(filter)
    ]);

    res.json({ success: true, data: pageResult(items, total, page, limit) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new ApiError(400, "Invalid case ID", "INVALID_ID");
    }

    const item = await Case.findById(req.params.id)
      .populate("client", "name email phone city avatarUrl")
      .populate("lawyer", "name email phone city avatarUrl lawyerProfile")
      .populate("timeline.actor", "name role");

    if (!item) throw new ApiError(404, "Case not found", "CASE_NOT_FOUND");
    if (!canAccessCase(item, req.user)) throw new ApiError(403, "You cannot access this case", "FORBIDDEN");

    res.json({ success: true, data: { case: item } });
  })
);

router.patch(
  "/:id/status",
  requireRole(ROLES.LAWYER, ROLES.ADMIN),
  validate(Joi.object({
    status: Joi.string().valid(...Object.values(CASE_STATUS)).required(),
    note: Joi.string().trim().max(1000).allow("")
  })),
  asyncHandler(async (req, res) => {
    const item = await Case.findById(req.params.id);
    if (!item) throw new ApiError(404, "Case not found", "CASE_NOT_FOUND");

    if (req.user.role === ROLES.LAWYER && !item.lawyer.equals(req.user._id)) {
      throw new ApiError(403, "You cannot update this case", "FORBIDDEN");
    }
    if (!canTransition(caseTransitions, item.status, req.body.status)) {
      throw new ApiError(409, `Cannot change ${item.status} to ${req.body.status}`, "INVALID_STATUS_TRANSITION");
    }

    item.status = req.body.status;
    item.timeline.push({
      status: req.body.status,
      note: cleanText(req.body.note, 1000),
      actor: req.user._id
    });
    if (req.body.status === CASE_STATUS.CLOSED) item.closedAt = new Date();
    await item.save();

    await createNotification(req.io, {
      user: item.client,
      type: "case",
      title: "Case status updated",
      message: `“${item.title}” is now ${req.body.status.replace("_", " ")}.`,
      link: `/app/cases/${item.id}`
    });

    res.json({ success: true, data: { case: item } });
  })
);

router.post(
  "/:id/documents",
  upload.array("documents", 5),
  asyncHandler(async (req, res) => {
    if (!req.files?.length) {
      throw new ApiError(400, "Select at least one document", "DOCUMENT_REQUIRED");
    }
    const item = await Case.findById(req.params.id);
    if (!item) {
      await cleanupTempFiles(req.files || []);
      throw new ApiError(404, "Case not found", "CASE_NOT_FOUND");
    }
    if (!canAccessCase(item, req.user)) {
      await cleanupTempFiles(req.files || []);
      throw new ApiError(403, "You cannot update this case", "FORBIDDEN");
    }
    if ([CASE_STATUS.CLOSED, CASE_STATUS.REJECTED].includes(item.status)) {
      await cleanupTempFiles(req.files || []);
      throw new ApiError(409, "Documents cannot be added to a closed case", "CASE_LOCKED");
    }
    if (item.documents.length + req.files.length > 20) {
      await cleanupTempFiles(req.files);
      throw new ApiError(409, "A case can contain at most 20 documents", "DOCUMENT_LIMIT_REACHED");
    }

    const stored = [];
    try {
      for (const file of req.files || []) {
        stored.push({ ...(await persistTempFile(file)), uploadedBy: req.user._id });
      }
      item.documents.push(...stored);
      await item.save();
      res.status(201).json({ success: true, data: { documents: item.documents } });
    } catch (error) {
      await Promise.all(stored.map((file) => deleteStoredFile(file.storageKey)));
      await cleanupTempFiles(req.files || []);
      throw error;
    }
  })
);

router.get(
  "/:caseId/documents/:documentId",
  asyncHandler(async (req, res) => {
    const item = await Case.findById(req.params.caseId);
    if (!item) throw new ApiError(404, "Case not found", "CASE_NOT_FOUND");
    if (!canAccessCase(item, req.user)) throw new ApiError(403, "You cannot access this file", "FORBIDDEN");

    const document = item.documents.id(req.params.documentId);
    if (!document) throw new ApiError(404, "Document not found", "DOCUMENT_NOT_FOUND");

    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.sendFile(safePath(document.storageKey));
  })
);

module.exports = router;
