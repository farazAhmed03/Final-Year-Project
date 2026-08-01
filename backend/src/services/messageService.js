const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const ApiError = require("../utils/ApiError");
const { cleanText } = require("../utils/text");
const { createNotification } = require("./notificationService");

async function assertParticipant(conversationId, userId) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId
  });
  if (!conversation) {
    throw new ApiError(404, "Conversation not found", "CONVERSATION_NOT_FOUND");
  }
  return conversation;
}

async function sendMessage({ io, conversationId, sender, body }) {
  const conversation = await assertParticipant(conversationId, sender._id);
  const cleanBody = cleanText(body, 4000);
  if (!cleanBody) {
    throw new ApiError(400, "Message cannot be empty", "EMPTY_MESSAGE");
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: sender._id,
    body: cleanBody,
    readBy: [sender._id]
  });

  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessagePreview = cleanBody.slice(0, 200);
  await conversation.save();

  const populated = await message.populate("sender", "name avatarUrl role");
  io?.to(`conversation:${conversation.id}`).emit("message:new", populated);

  const receiver = conversation.participants.find((id) => !id.equals(sender._id));
  if (receiver) {
    await createNotification(io, {
      user: receiver,
      type: "message",
      title: `New message from ${sender.name}`,
      message: cleanBody.slice(0, 160),
      link: `/app/chat/${conversation.id}`
    });
  }

  return populated;
}

module.exports = { assertParticipant, sendMessage };
