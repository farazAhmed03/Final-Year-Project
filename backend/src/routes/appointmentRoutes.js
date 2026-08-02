const express = require("express");
const Joi = require("joi");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const {
  requireRole,
  requireVerifiedEmail
} = require("../middleware/authorize");
const {
  pagination,
  pageResult
} = require("../utils/pagination");
const { cleanText } = require("../utils/text");
const {
  createNotification
} = require("../services/notificationService");
const {
  ensureConversationForAppointment
} = require("../services/conversationService");
const {
  ROLES,
  APPOINTMENT_STATUS,
  LAWYER_VERIFICATION
} = require("../constants");
const {
  appointmentTransitions,
  canTransition
} = require("../utils/transitions");

const router = express.Router();
router.use(authenticate, requireVerifiedEmail);

const createSchema = Joi.object({
  lawyerId: Joi.string().hex().length(24).required(),
  startsAt: Joi.date().iso().greater("now").required(),
  durationMinutes: Joi.number().valid(30, 45, 60, 90).default(60),
  mode: Joi.string().valid("online", "office", "phone").default("online"),
  reason: Joi.string().trim().min(10).max(2000).required()
});

router.post(
  "/",
  requireRole(ROLES.CLIENT),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const lawyer = await User.findOne({
      _id: req.body.lawyerId,
      role: ROLES.LAWYER,
      emailVerified: true,
      status: "active",
      "lawyerProfile.verificationStatus": LAWYER_VERIFICATION.APPROVED
    });

    if (!lawyer) {
      throw new ApiError(
        404,
        "Approved lawyer not found",
        "LAWYER_NOT_FOUND"
      );
    }

    const startsAt = new Date(req.body.startsAt);
    const endAt = new Date(
      startsAt.getTime() + req.body.durationMinutes * 60 * 1000
    );
    const conflictStart = new Date(
      startsAt.getTime() - 90 * 60 * 1000
    );
    const conflictEnd = new Date(
      endAt.getTime() + 90 * 60 * 1000
    );

    const conflict = await Appointment.exists({
      lawyer: lawyer._id,
      status: {
        $in: [
          APPOINTMENT_STATUS.REQUESTED,
          APPOINTMENT_STATUS.CONFIRMED
        ]
      },
      startsAt: {
        $gte: conflictStart,
        $lte: conflictEnd
      }
    });

    if (conflict) {
      throw new ApiError(
        409,
        "This time is too close to another appointment",
        "APPOINTMENT_CONFLICT"
      );
    }

    const hourlyRate = lawyer.lawyerProfile?.hourlyRate || 0;
    const fee = Math.round(
      (hourlyRate * req.body.durationMinutes / 60) * 100
    ) / 100;

    const appointment = await Appointment.create({
      client: req.user._id,
      lawyer: lawyer._id,
      startsAt,
      durationMinutes: req.body.durationMinutes,
      mode: req.body.mode,
      reason: cleanText(req.body.reason, 2000),
      fee,
      paymentStatus: fee > 0 ? "pending" : "not_required"
    });

    await createNotification(req.io, {
      user: lawyer._id,
      type: "appointment",
      title: "New appointment request",
      message: `${req.user.name} requested an appointment.`,
      link: "/app/appointments"
    });

    const populated = await appointment.populate([
      {
        path: "client",
        select: "name email avatarUrl"
      },
      {
        path: "lawyer",
        select: "name avatarUrl lawyerProfile.specialization"
      }
    ]);

    res.status(201).json({
      success: true,
      data: { appointment: populated }
    });
  })
);

router.get(
  "/",
  validate(
    Joi.object({
      status: Joi.string().valid(...Object.values(APPOINTMENT_STATUS)),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(50).default(20)
    }),
    "query"
  ),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query);
    const roleField = req.user.role === ROLES.CLIENT
      ? "client"
      : req.user.role === ROLES.LAWYER
        ? "lawyer"
        : null;

    const filter = roleField
      ? { [roleField]: req.user._id }
      : {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [items, total] = await Promise.all([
      Appointment.find(filter)
        .populate("client", "name email avatarUrl")
        .populate(
          "lawyer",
          "name email avatarUrl lawyerProfile.specialization"
        )
        .sort({ startsAt: -1 })
        .skip(skip)
        .limit(limit),
      Appointment.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: pageResult(items, total, page, limit)
    });
  })
);

router.patch(
  "/:id/status",
  validate(
    Joi.object({
      status: Joi.string()
        .valid(...Object.values(APPOINTMENT_STATUS))
        .required(),
      note: Joi.string().trim().max(500).allow("")
    })
  ),
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      throw new ApiError(
        404,
        "Appointment not found",
        "APPOINTMENT_NOT_FOUND"
      );
    }

    const isClient = appointment.client.equals(req.user._id);
    const isLawyer = appointment.lawyer.equals(req.user._id);
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isClient && !isLawyer && !isAdmin) {
      throw new ApiError(
        403,
        "You cannot update this appointment",
        "FORBIDDEN"
      );
    }

    const nextStatus = req.body.status;

    if (!canTransition(
      appointmentTransitions,
      appointment.status,
      nextStatus
    )) {
      throw new ApiError(
        409,
        `Cannot change ${appointment.status} to ${nextStatus}`,
        "INVALID_STATUS_TRANSITION"
      );
    }

    if (isClient && nextStatus !== APPOINTMENT_STATUS.CANCELLED) {
      throw new ApiError(
        403,
        "Clients may only cancel appointments",
        "FORBIDDEN"
      );
    }

    if (
      isLawyer &&
      ![
        APPOINTMENT_STATUS.CONFIRMED,
        APPOINTMENT_STATUS.REJECTED,
        APPOINTMENT_STATUS.COMPLETED,
        APPOINTMENT_STATUS.CANCELLED
      ].includes(nextStatus)
    ) {
      throw new ApiError(
        403,
        "Lawyer cannot apply this status",
        "FORBIDDEN"
      );
    }

    if (
      nextStatus === APPOINTMENT_STATUS.COMPLETED &&
      appointment.startsAt > new Date() &&
      !isAdmin
    ) {
      throw new ApiError(
        409,
        "A future appointment cannot be completed",
        "APPOINTMENT_IN_FUTURE"
      );
    }

    appointment.status = nextStatus;
    appointment.decisionNote = cleanText(req.body.note, 500);

    if (nextStatus === APPOINTMENT_STATUS.CANCELLED) {
      appointment.cancelledBy = req.user._id;
    }

    await appointment.save();

    if (nextStatus === APPOINTMENT_STATUS.CONFIRMED) {
      try {
        await ensureConversationForAppointment(appointment);
      } catch (error) {
        console.error(
          "Appointment confirmed but automatic conversation creation failed",
          error
        );
      }
    }

    const recipient = isClient
      ? appointment.lawyer
      : appointment.client;

    await createNotification(req.io, {
      user: recipient,
      type: "appointment",
      title: "Appointment updated",
      message: `Appointment status changed to ${nextStatus.replace("_", " ")}.`,
      link: "/app/appointments"
    });

    await appointment.populate([
      {
        path: "client",
        select: "name email avatarUrl"
      },
      {
        path: "lawyer",
        select: "name email avatarUrl lawyerProfile.specialization"
      }
    ]);

    res.json({
      success: true,
      data: { appointment }
    });
  })
);

module.exports = router;
