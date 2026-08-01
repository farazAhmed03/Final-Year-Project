const express = require("express");
const Appointment = require("../models/Appointment");
const Case = require("../models/Case");
const Review = require("../models/Review");
const User = require("../models/User");
const Notification = require("../models/Notification");
const Payment = require("../models/Payment");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");
const { ROLES, LAWYER_VERIFICATION } = require("../constants");

const router = express.Router();
router.use(authenticate);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const unreadPromise = Notification.countDocuments({ user: req.user._id, readAt: null });
    let stats;
    let recentCases = [];
    let recentAppointments = [];

    if (req.user.role === ROLES.CLIENT) {
      const [
        appointments,
        upcoming,
        activeCases,
        closedCases,
        paid,
        unread
      ] = await Promise.all([
        Appointment.countDocuments({ client: req.user._id }),
        Appointment.countDocuments({
          client: req.user._id,
          status: "confirmed",
          startsAt: { $gte: new Date() }
        }),
        Case.countDocuments({
          client: req.user._id,
          status: { $in: ["submitted", "accepted", "in_progress"] }
        }),
        Case.countDocuments({ client: req.user._id, status: "closed" }),
        Payment.aggregate([
          { $match: { user: req.user._id, status: "paid" } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        unreadPromise
      ]);
      stats = {
        appointments,
        upcoming,
        activeCases,
        closedCases,
        totalPaid: paid[0]?.total || 0,
        unreadNotifications: unread
      };
      [recentCases, recentAppointments] = await Promise.all([
        Case.find({ client: req.user._id })
          .populate("lawyer", "name avatarUrl")
          .sort({ updatedAt: -1 })
          .limit(5),
        Appointment.find({ client: req.user._id })
          .populate("lawyer", "name avatarUrl lawyerProfile.specialization")
          .sort({ startsAt: -1 })
          .limit(5)
      ]);
    } else if (req.user.role === ROLES.LAWYER) {
      const [
        pendingAppointments,
        upcoming,
        activeCases,
        closedCases,
        rating,
        unread
      ] = await Promise.all([
        Appointment.countDocuments({ lawyer: req.user._id, status: "requested" }),
        Appointment.countDocuments({
          lawyer: req.user._id,
          status: "confirmed",
          startsAt: { $gte: new Date() }
        }),
        Case.countDocuments({
          lawyer: req.user._id,
          status: { $in: ["submitted", "accepted", "in_progress"] }
        }),
        Case.countDocuments({ lawyer: req.user._id, status: "closed" }),
        Review.aggregate([
          { $match: { lawyer: req.user._id } },
          { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }
        ]),
        unreadPromise
      ]);
      stats = {
        pendingAppointments,
        upcoming,
        activeCases,
        closedCases,
        averageRating: Number((rating[0]?.average || 0).toFixed(1)),
        reviewCount: rating[0]?.count || 0,
        unreadNotifications: unread
      };
      [recentCases, recentAppointments] = await Promise.all([
        Case.find({ lawyer: req.user._id })
          .populate("client", "name avatarUrl")
          .sort({ updatedAt: -1 })
          .limit(5),
        Appointment.find({ lawyer: req.user._id })
          .populate("client", "name avatarUrl")
          .sort({ startsAt: -1 })
          .limit(5)
      ]);
    } else {
      const [
        users,
        pendingLawyers,
        activeCases,
        appointments,
        unread
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({
          role: ROLES.LAWYER,
          "lawyerProfile.verificationStatus": LAWYER_VERIFICATION.PENDING
        }),
        Case.countDocuments({ status: { $in: ["submitted", "accepted", "in_progress"] } }),
        Appointment.countDocuments(),
        unreadPromise
      ]);
      stats = { users, pendingLawyers, activeCases, appointments, unreadNotifications: unread };
      [recentCases, recentAppointments] = await Promise.all([
        Case.find().populate("client lawyer", "name avatarUrl").sort({ updatedAt: -1 }).limit(5),
        Appointment.find().populate("client lawyer", "name avatarUrl").sort({ createdAt: -1 }).limit(5)
      ]);
    }

    res.json({
      success: true,
      data: { stats, recentCases, recentAppointments }
    });
  })
);

module.exports = router;
