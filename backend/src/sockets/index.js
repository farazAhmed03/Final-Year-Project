const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Message = require("../models/Message");
const env = require("../config/env");
const { accessCookie } = require("../utils/cookies");
const {
  assertParticipant,
  sendMessage
} = require("../services/messageService");

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        const key = index >= 0
          ? part.slice(0, index)
          : part;
        const value = index >= 0
          ? part.slice(index + 1)
          : "";

        return [key, decodeURIComponent(value)];
      })
  );
}

function safeError(error) {
  return {
    ok: false,
    error: {
      code: error.code || "SOCKET_ERROR",
      message: error.statusCode && error.statusCode < 500
        ? error.message
        : "Request failed"
    }
  };
}

function initializeSockets(io) {
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(
        socket.handshake.headers.cookie
      );
      const token = cookies[accessCookie]
        || socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const payload = jwt.verify(
        token,
        env.jwtAccessSecret,
        {
          algorithms: ["HS256"],
          issuer: "legalsphere-api",
          audience: "legalsphere-web"
        }
      );

      const user = await User.findById(payload.sub);

      if (
        !user ||
        user.status !== "active" ||
        user.tokenVersion !== payload.ver
      ) {
        return next(new Error("Invalid session"));
      }

      socket.data.user = user;
      socket.data.tokenExpiresAt = payload.exp * 1000;
      next();
    } catch {
      next(new Error("Invalid or expired session"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);

    const expiresIn = Math.max(
      0,
      socket.data.tokenExpiresAt - Date.now()
    );

    const expiryTimer = setTimeout(
      () => socket.disconnect(true),
      expiresIn
    );

    socket.on("disconnect", () => {
      clearTimeout(expiryTimer);
    });

    socket.on(
      "conversation:join",
      async (
        { conversationId } = {},
        callback = () => {}
      ) => {
        try {
          await assertParticipant(
            conversationId,
            user._id
          );

          await socket.join(
            `conversation:${conversationId}`
          );

          callback({ ok: true });
        } catch (error) {
          callback(safeError(error));
        }
      }
    );

    socket.on(
      "conversation:leave",
      ({ conversationId } = {}) => {
        if (conversationId) {
          socket.leave(
            `conversation:${conversationId}`
          );
        }
      }
    );

    socket.on(
      "message:send",
      async (
        { conversationId, body } = {},
        callback = () => {}
      ) => {
        try {
          const message = await sendMessage({
            io,
            conversationId,
            sender: user,
            body
          });

          callback({ ok: true, message });
        } catch (error) {
          callback(safeError(error));
        }
      }
    );

    socket.on(
      "message:read",
      async (
        { conversationId } = {},
        callback = () => {}
      ) => {
        try {
          await assertParticipant(
            conversationId,
            user._id
          );

          await Message.updateMany(
            {
              conversation: conversationId,
              sender: { $ne: user._id },
              readBy: { $ne: user._id }
            },
            {
              $addToSet: {
                readBy: user._id
              }
            }
          );

          io.to(`conversation:${conversationId}`)
            .emit("message:read", {
              conversationId,
              userId: user.id
            });

          callback({ ok: true });
        } catch (error) {
          callback(safeError(error));
        }
      }
    );

    socket.on(
      "typing:start",
      async ({ conversationId } = {}) => {
        if (!mongoose.isValidObjectId(conversationId)) {
          return;
        }

        try {
          await assertParticipant(
            conversationId,
            user._id
          );

          socket
            .to(`conversation:${conversationId}`)
            .emit("typing:update", {
              conversationId,
              userId: user.id,
              typing: true
            });
        } catch {
          // Typing indicators never bypass conversation access rules.
        }
      }
    );

    socket.on(
      "typing:stop",
      async ({ conversationId } = {}) => {
        if (!mongoose.isValidObjectId(conversationId)) {
          return;
        }

        try {
          await assertParticipant(
            conversationId,
            user._id
          );

          socket
            .to(`conversation:${conversationId}`)
            .emit("typing:update", {
              conversationId,
              userId: user.id,
              typing: false
            });
        } catch {
          // Typing indicators never bypass conversation access rules.
        }
      }
    );
  });
}

module.exports = initializeSockets;
