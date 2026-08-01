const ApiError = require("../utils/ApiError");

module.exports = function validate(schema, source = "body") {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      return next(new ApiError(
        400,
        "Validation failed",
        "VALIDATION_ERROR",
        error.details.map((item) => ({
          field: item.path.join("."),
          message: item.message
        }))
      ));
    }

    req[source] = value;
    next();
  };
};
