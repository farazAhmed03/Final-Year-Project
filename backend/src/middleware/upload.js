const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

const allowed = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"]
]);

const tempDir = path.join(os.tmpdir(), "legalsphere-uploads");
fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, tempDir),
  filename: (_req, file, callback) => {
    const extension = allowed.get(file.mimetype) || "";
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    files: 5,
    fileSize: env.maxFileSizeMb * 1024 * 1024,
    fields: 20
  },
  fileFilter: (_req, file, callback) => {
    if (!allowed.has(file.mimetype)) {
      return callback(new ApiError(415, "Only PDF, JPEG and PNG files are allowed", "FILE_TYPE_NOT_ALLOWED"));
    }
    callback(null, true);
  }
});

module.exports = { upload, allowed };
