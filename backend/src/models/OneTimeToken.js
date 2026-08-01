const mongoose = require("mongoose");

const oneTimeTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    purpose: {
      type: String,
      enum: ["verify_email", "reset_password"],
      required: true,
      index: true
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    attempts: { type: Number, default: 0, min: 0 },
    consumedAt: Date
  },
  { timestamps: true }
);

oneTimeTokenSchema.index({ user: 1, purpose: 1, consumedAt: 1 });

module.exports = mongoose.model("OneTimeToken", oneTimeTokenSchema);
