const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true, index: true },
    provider: { type: String, enum: ["stripe"], default: "stripe" },
    providerSessionId: { type: String, unique: true, sparse: true },
    providerPaymentIntentId: { type: String, sparse: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true },
    status: {
      type: String,
      enum: ["created", "pending", "paid", "failed", "refunded"],
      default: "created",
      index: true
    },
    paidAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
