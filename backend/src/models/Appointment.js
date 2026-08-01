const mongoose = require("mongoose");
const { APPOINTMENT_STATUS } = require("../constants");

const appointmentSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lawyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, enum: [30, 45, 60, 90], default: 60 },
    mode: { type: String, enum: ["online", "office", "phone"], default: "online" },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.REQUESTED,
      index: true
    },
    fee: { type: Number, min: 0, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["not_required", "pending", "paid", "refunded"],
      default: "pending",
      index: true
    },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decisionNote: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true, optimisticConcurrency: true }
);

appointmentSchema.index({ lawyer: 1, startsAt: 1, status: 1 });
appointmentSchema.index({ client: 1, createdAt: -1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
