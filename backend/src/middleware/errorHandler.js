const fs = require("fs");
const multer = require("multer");
const mongoose = require("mongoose");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

module.exports = function errorHandler(error, req, res, _next) {
  // Multer may have written temporary files before later validation fails.
  // Best-effort removal prevents abandoned uploads from accumulating.
  const uploadFiles = [
    ...(Array.isArray(req.files) ? req.files : []),
    ...(req.file ? [req.file] : [])
  ];
  for (const file of uploadFiles) {
    if (file?.path) fs.unlink(file.path, () => {});
  }

  let normalized = error;

  if (error instanceof multer.MulterError) {
    normalized = new ApiError(
      error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
      error.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : error.message,
      error.code
    );
  } else if (error instanceof mongoose.Error.ValidationError) {
    normalized = new ApiError(400, "Database validation failed", "VALIDATION_ERROR");
  } else if (error?.code === 11000) {
    normalized = new ApiError(409, "A record with these details already exists", "DUPLICATE_RECORD");
  } else if (!(error instanceof ApiError)) {
    normalized = new ApiError(error.statusCode || 500, error.message || "Internal server error", error.code || "INTERNAL_ERROR");
  }

  const status = normalized.statusCode || 500;
  if (status >= 500) {
    console.error(JSON.stringify({
      level: "error",
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      message: error.message,
      stack: env.nodeEnv === "development" ? error.stack : undefined
    }));
  }

  res.status(status).json({
    success: false,
    error: {
      code: normalized.code,
      message: status >= 500 && env.nodeEnv === "production"
        ? "An unexpected error occurred"
        : normalized.message,
      details: normalized.details,
      requestId: req.id
    }
  });
};
