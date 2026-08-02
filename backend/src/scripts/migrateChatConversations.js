const mongoose = require("mongoose");
const {
  connectDatabase,
  disconnectDatabase
} = require("../config/database");
const Appointment = require("../models/Appointment");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const {
  APPOINTMENT_STATUS,
  ROLES
} = require("../constants");
const {
  participantKey,
  ensureConversationForAppointment
} = require("../services/conversationService");

const ELIGIBLE_STATUSES = [
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.COMPLETED
];

async function main() {
  await connectDatabase();

  const conversations = await Conversation.find({})
    .sort({ createdAt: 1, _id: 1 });

  const participantIds = [
    ...new Set(
      conversations.flatMap((conversation) =>
        conversation.participants.map(String)
      )
    )
  ];

  const users = await User.find({
    _id: { $in: participantIds }
  }).select("role");

  const roleMap = new Map(
    users.map((user) => [String(user._id), user.role])
  );

  const groups = new Map();

  for (const conversation of conversations) {
    if (conversation.participants.length !== 2) {
      console.warn(
        "Skipped malformed conversation:",
        String(conversation._id)
      );
      continue;
    }

    const key = participantKey(
      conversation.participants[0],
      conversation.participants[1]
    );

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(conversation);
  }

  let mergedConversations = 0;
  let movedMessages = 0;
  let lockedConversations = 0;

  for (const [key, group] of groups.entries()) {
    const canonical = group[0];
    const duplicates = group.slice(1);
    const duplicateIds = duplicates.map((item) => item._id);

    if (duplicateIds.length) {
      const moveResult = await Message.updateMany(
        { conversation: { $in: duplicateIds } },
        { $set: { conversation: canonical._id } }
      );

      movedMessages += moveResult.modifiedCount || 0;

      await Conversation.deleteMany({
        _id: { $in: duplicateIds }
      });

      mergedConversations += duplicateIds.length;
    }

    const ids = canonical.participants.map(String);
    const clientId = ids.find(
      (id) => roleMap.get(id) === ROLES.CLIENT
    );
    const lawyerId = ids.find(
      (id) => roleMap.get(id) === ROLES.LAWYER
    );

    const appointment = clientId && lawyerId
      ? await Appointment.findOne({
          client: clientId,
          lawyer: lawyerId,
          status: { $in: ELIGIBLE_STATUSES }
        }).sort({ updatedAt: -1, createdAt: -1 })
      : null;

    const latestMessage = await Message.findOne({
      conversation: canonical._id
    }).sort({ createdAt: -1 });

    const update = {
      $set: {
        participantKey: key,
        lastMessageAt: latestMessage?.createdAt
          || canonical.lastMessageAt
          || canonical.createdAt,
        lastMessagePreview: latestMessage?.body?.slice(0, 200)
          || canonical.lastMessagePreview
          || ""
      },
      $unset: {
        case: ""
      }
    };

    if (clientId && lawyerId) {
      update.$set.participants = [
        new mongoose.Types.ObjectId(clientId),
        new mongoose.Types.ObjectId(lawyerId)
      ];
    }

    if (appointment) {
      update.$set.unlockedAt = canonical.unlockedAt
        || appointment.updatedAt
        || appointment.createdAt
        || new Date();
      update.$set.unlockedByAppointment = appointment._id;
    } else if (!canonical.unlockedAt) {
      update.$set.unlockedAt = null;
      update.$set.unlockedByAppointment = null;
      lockedConversations += 1;
    }

    await Conversation.collection.updateOne(
      { _id: canonical._id },
      update
    );
  }

  const eligibleAppointments = await Appointment.find({
    status: { $in: ELIGIBLE_STATUSES }
  }).sort({ updatedAt: 1, createdAt: 1 });

  const ensuredPairs = new Set();
  let createdOrUnlocked = 0;

  for (const appointment of eligibleAppointments) {
    const key = participantKey(
      appointment.client,
      appointment.lawyer
    );

    if (ensuredPairs.has(key)) {
      continue;
    }

    ensuredPairs.add(key);
    await ensureConversationForAppointment(appointment);
    createdOrUnlocked += 1;
  }

  await Conversation.createIndexes();

  console.log("Chat conversation migration completed.");
  console.log("Duplicate conversations removed:", mergedConversations);
  console.log("Messages moved into shared threads:", movedMessages);
  console.log("Client-lawyer threads ensured:", createdOrUnlocked);
  console.log(
    "Threads still locked because no confirmed/completed appointment exists:",
    lockedConversations
  );
  console.log(
    "Visible conversations:",
    await Conversation.countDocuments({
      unlockedAt: { $ne: null }
    })
  );
}

main()
  .catch((error) => {
    console.error("Chat migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
