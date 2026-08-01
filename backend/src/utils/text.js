const sanitizeHtml = require("sanitize-html");

function cleanText(value, maxLength = 5000) {
  if (typeof value !== "string") return value;
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function rejectUnsafeKeys(value, path = "body") {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".")) {
      const error = new Error(`Unsafe key at ${path}.${key}`);
      error.statusCode = 400;
      error.code = "UNSAFE_INPUT";
      throw error;
    }
    rejectUnsafeKeys(nested, `${path}.${key}`);
  }
}

module.exports = { cleanText, rejectUnsafeKeys };
