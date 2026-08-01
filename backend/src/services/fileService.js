const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

async function ensureUploadDir() {
  await fs.mkdir(env.uploadDir, { recursive: true, mode: 0o700 });
}

function extensionFor(mimeType) {
  return {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png"
  }[mimeType] || "";
}

async function validateMagicBytes(file) {
  const handle = await fs.open(file.path, "r");
  try {
    const buffer = Buffer.alloc(8);
    await handle.read(buffer, 0, 8, 0);
    const valid = {
      "application/pdf": buffer.subarray(0, 5).toString("ascii") === "%PDF-",
      "image/jpeg": buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
      "image/png": buffer.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    }[file.mimetype];

    if (!valid) {
      throw new ApiError(415, "File content does not match its declared type", "FILE_SIGNATURE_INVALID");
    }
  } finally {
    await handle.close();
  }
}

async function persistTempFile(file) {
  await validateMagicBytes(file);
  await ensureUploadDir();
  const storageKey = `${crypto.randomUUID()}${extensionFor(file.mimetype)}`;
  const destination = path.join(env.uploadDir, storageKey);
  await fs.rename(file.path, destination);
  await fs.chmod(destination, 0o600);
  return {
    storageKey,
    originalName: path.basename(file.originalname).slice(0, 255),
    mimeType: file.mimetype,
    size: file.size
  };
}

function safePath(storageKey) {
  const target = path.resolve(env.uploadDir, storageKey);
  const root = `${path.resolve(env.uploadDir)}${path.sep}`;
  if (!target.startsWith(root)) {
    throw new ApiError(400, "Invalid file path", "INVALID_FILE_PATH");
  }
  return target;
}

async function deleteStoredFile(storageKey) {
  try {
    await fs.unlink(safePath(storageKey));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function cleanupTempFiles(files = []) {
  await Promise.all(files.map(async (file) => {
    try {
      await fs.unlink(file.path);
    } catch (error) {
      if (error.code !== "ENOENT") console.error(error);
    }
  }));
}

module.exports = {
  ensureUploadDir,
  persistTempFile,
  safePath,
  deleteStoredFile,
  cleanupTempFiles
};
