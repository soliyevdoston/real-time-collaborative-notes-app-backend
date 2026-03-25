"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.validateParams = exports.validateBody = void 0;
const validateBody = (schema) => {
    return (req, _res, next) => {
        req.body = schema.parse(req.body);
        next();
    };
};
exports.validateBody = validateBody;
const validateParams = (schema) => {
    return (req, _res, next) => {
        req.params = schema.parse(req.params);
        next();
    };
};
exports.validateParams = validateParams;
const validateQuery = (schema) => {
    return (req, _res, next) => {
        req.query = schema.parse(req.query);
        next();
    };
};
exports.validateQuery = validateQuery;
