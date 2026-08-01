const http = require("http");
const { Server } = require("socket.io");
const createApp = require("./app");
const env = require("./config/env");
const { connectDatabase, disconnectDatabase } = require("./config/database");
const { ensureUploadDir } = require("./services/fileService");
const initializeSockets = require("./sockets");

async function start() {
  await connectDatabase();
  await ensureUploadDir();

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: env.appOrigins,
      credentials: true
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: false
    },
    maxHttpBufferSize: 100_000
  });

  app.set("io", io);
  initializeSockets(io);

  server.listen(env.port, "0.0.0.0", () => {
    console.log(JSON.stringify({
      level: "info",
      event: "server_started",
      port: env.port,
      environment: env.nodeEnv
    }));
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: "info", event: "shutdown", signal }));

    const force = setTimeout(() => process.exit(1), 15000);
    force.unref();

    io.close();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (error) => {
    console.error(JSON.stringify({
      level: "error",
      event: "unhandled_rejection",
      message: error?.message
    }));
    shutdown("unhandledRejection");
  });
}

start().catch((error) => {
  console.error(JSON.stringify({
    level: "fatal",
    event: "startup_failed",
    message: error.message,
    stack: env.nodeEnv === "development" ? error.stack : undefined
  }));
  process.exit(1);
});
