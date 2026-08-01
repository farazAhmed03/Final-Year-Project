const crypto = require("crypto");

module.exports = function requestContext(req, res, next) {
  const incoming = req.get("x-request-id");
  req.id = incoming && incoming.length <= 100 ? incoming : crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
};
