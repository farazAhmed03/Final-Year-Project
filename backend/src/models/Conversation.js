const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }],
    participantKey: { type: String, required: true, unique: true, index: true },
    case: { type: mongoose.Schema.Types.ObjectId, ref: "Case" },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessagePreview: { type: String, maxlength: 200 }
  },
  { timestamps: true }
);

conversationSchema.path("participants").validate(
  (participants) => Array.isArray(participants) && participants.length === 2,
  "A conversation must have exactly two participants"
);

module.exports = mongoose.model("Conversation", conversationSchema);
