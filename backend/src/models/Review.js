const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    case: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lawyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 2000 }
  },
  { timestamps: true }
);

reviewSchema.index({ case: 1, client: 1 }, { unique: true });
reviewSchema.index({ lawyer: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
