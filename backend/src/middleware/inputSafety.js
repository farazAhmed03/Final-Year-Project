const { rejectUnsafeKeys } = require("../utils/text");

module.exports = function inputSafety(req, _res, next) {
  try {
    rejectUnsafeKeys(req.body, "body");
    rejectUnsafeKeys(req.query, "query");
    rejectUnsafeKeys(req.params, "params");
    next();
  } catch (error) {
    next(error);
  }
};
