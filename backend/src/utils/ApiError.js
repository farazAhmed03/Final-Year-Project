class ApiError extends Error {
  constructor(statusCode, message, code = "REQUEST_FAILED", details) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }
}

module.exports = ApiError;
