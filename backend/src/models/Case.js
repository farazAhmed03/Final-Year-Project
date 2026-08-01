const mongoose = require("mongoose");
const { CASE_STATUS } = require("../constants");

const documentSchema = new mongoose.Schema(
  {
    storageKey: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, maxlength: 1000 },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    at: { type: Date, default: Date.now }
  },
  { _id: true }
);

const caseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 10000 },
    category: { type: String, required: true, trim: true, maxlength: 100, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lawyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", sparse: true },
    status: {
      type: String,
      enum: Object.values(CASE_STATUS),
      default: CASE_STATUS.SUBMITTED,
      index: true
    },
    documents: [documentSchema],
    timeline: [timelineSchema],
    closedAt: Date
  },
  { timestamps: true, optimisticConcurrency: true }
);

caseSchema.index({ client: 1, lawyer: 1, createdAt: -1 });
caseSchema.index({ lawyer: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("Case", caseSchema);
