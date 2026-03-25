"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFoundHandler = void 0;
const zod_1 = require("zod");
const http_error_1 = require("../errors/http-error");
const notFoundHandler = (_req, res) => {
    res.status(404).json({ message: "So'ralgan yo'nalish topilmadi" });
};
exports.notFoundHandler = notFoundHandler;
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof http_error_1.HttpError) {
        res.status(err.statusCode).json({
            message: err.message,
            details: err.details,
        });
        return;
    }
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            message: "Validatsiya xatosi",
            details: err.flatten(),
        });
        return;
    }
    console.error(err);
    res.status(500).json({ message: "Server ichki xatosi" });
};
exports.errorHandler = errorHandler;
