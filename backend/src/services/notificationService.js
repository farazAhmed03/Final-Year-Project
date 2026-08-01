const Notification = require("../models/Notification");

async function createNotification(io, payload) {
  const notification = await Notification.create(payload);
  io?.to(`user:${payload.user}`).emit("notification:new", notification);
  return notification;
}

module.exports = { createNotification };
