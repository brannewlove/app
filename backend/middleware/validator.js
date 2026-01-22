const { validationResult } = require('express-validator');
const { error } = require('../utils/response');

// Middleware to check for validation errors
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Return only the first error message for simplicity, or all of them
        const msg = errors.array().map(err => `${err.param}: ${err.msg}`).join(', ');
        return error(res, `Validation Error: ${msg}`, 400);
    }
    next();
};

module.exports = { validate };
