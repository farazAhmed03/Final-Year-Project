const Appointment = require("../models/Appointment");
const Conversation = require("../models/Conversation");
const ApiError = require("../utils/ApiError");
const {
  ROLES,
  APPOINTMENT_STATUS
} = require("../constants");

const CHAT_APPOINTMENT_STATUSES = [
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.COMPLETED
];

function documentId(value) {
  return value?._id || value;
}

function participantKey(left, right) {
  return [String(documentId(left)), String(documentId(right))]
    .sort()
    .join(":");
}

function resolveClientAndLawyer(firstUser, secondUser) {
  const users = [firstUser, secondUser];
  const client = users.find((user) => user?.role === ROLES.CLIENT);
  const lawyer = users.find((user) => user?.role === ROLES.LAWYER);

  if (!client || !lawyer) {
    throw new ApiError(
      403,
      "Messaging is available only between a client and a lawyer",
      "INVALID_CHAT_PARTICIPANTS"
    );
  }

  return { client, lawyer };
}

async function findEligibleAppointment(clientId, lawyerId) {
  return Appointment.findOne({
    client: documentId(clientId),
    lawyer: documentId(lawyerId),
    status: { $in: CHAT_APPOINTMENT_STATUSES }
  }).sort({ updatedAt: -1, createdAt: -1 });
}

async function ensureConversationForAppointment(appointment) {
  if (!appointment || !CHAT_APPOINTMENT_STATUSES.includes(appointment.status)) {
    throw new ApiError(
      409,
      "Messaging becomes available after the appointment is confirmed",
      "CHAT_NOT_UNLOCKED"
    );
  }

  const clientId = documentId(appointment.client);
  const lawyerId = documentId(appointment.lawyer);
  const key = participantKey(clientId, lawyerId);
  const now = new Date();

  return Conversation.findOneAndUpdate(
    { participantKey: key },
    {
      $setOnInsert: {
        participants: [clientId, lawyerId],
        participantKey: key,
        lastMessageAt: now,
        lastMessagePreview: ""
      },
      $set: {
        unlockedAt: now,
        unlockedByAppointment: appointment._id
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );
}

async function ensureConversationForUsers(firstUser, secondUser) {
  const { client, lawyer } = resolveClientAndLawyer(firstUser, secondUser);
  const appointment = await findEligibleAppointment(client._id, lawyer._id);

  if (!appointment) {
    throw new ApiError(
      403,
      "Messaging becomes available after the lawyer confirms an appointment",
      "CHAT_NOT_UNLOCKED"
    );
  }

  return ensureConversationForAppointment(appointment);
}

module.exports = {
  CHAT_APPOINTMENT_STATUSES,
  participantKey,
  resolveClientAndLawyer,
  findEligibleAppointment,
  ensureConversationForAppointment,
  ensureConversationForUsers
};
