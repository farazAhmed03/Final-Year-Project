const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const env = require("./config/env");
const ApiError = require("./utils/ApiError");
const requestContext = require("./middleware/requestContext");
const inputSafety = require("./middleware/inputSafety");
const { csrfProtection } = require("./middleware/csrf");
const { apiLimiter } = require("./middleware/rateLimits");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const lawyerRoutes = require("./routes/lawyerRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const caseRoutes = require("./routes/caseRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { paymentRouter, stripeWebhook } = require("./routes/paymentRoutes");
const openapi = require("./docs/openapi");
const { normalizeOrigin } = require("./config/env");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestContext);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" }
  }));

  // Stripe signature verification requires the unmodified request body.
  app.post(
    "/api/v1/payments/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    stripeWebhook
  );

  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      // Non-browser clients may not send Origin. Browser origins are normalized
      // so a harmless trailing slash does not cause a false CORS rejection.
      const normalized = origin ? normalizeOrigin(origin) : "";
      if (!origin || (normalized && env.appOrigins.includes(normalized))) {
        return callback(null, true);
      }
      return callback(new ApiError(403, "Origin is not allowed", "CORS_DENIED"));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Request-ID"]
  }));
  app.use(compression());
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  app.use(apiLimiter);
  app.use(inputSafety);

  app.use((req, _res, next) => {
    req.io = app.get("io");
    next();
  });

  app.get("/api/health/live", (_req, res) => {
    res.json({ status: "ok", service: "legalsphere-api" });
  });

  app.get("/api/health/ready", (req, res) => {
    const mongoose = require("mongoose");
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready" });
  });

  app.get("/api/openapi.json", (_req, res) => res.json(openapi));

  app.use("/api/v1", csrfProtection);
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/lawyers", lawyerRoutes);
  app.use("/api/v1/appointments", appointmentRoutes);
  app.use("/api/v1/cases", caseRoutes);
  app.use("/api/v1/reviews", reviewRoutes);
  app.use("/api/v1/conversations", conversationRoutes);
  app.use("/api/v1/notifications", notificationRoutes);
  app.use("/api/v1/dashboard", dashboardRoutes);
  app.use("/api/v1/payments", paymentRouter);
  app.use("/api/v1/admin", adminRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
