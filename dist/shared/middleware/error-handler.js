"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFoundHandler = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const http_error_1 = require("../errors/http-error");
const isPrismaErrorCode = (value) => typeof value === "string" && /^P\d{4}$/.test(value);
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
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        res.status(500).json({
            message: "Database xatosi",
            code: err.code,
            details: err.meta ?? null,
        });
        return;
    }
    if (err instanceof client_1.Prisma.PrismaClientInitializationError) {
        res.status(500).json({
            message: "Database ulanish xatosi",
            code: "PRISMA_INIT_ERROR",
        });
        return;
    }
    if (err instanceof client_1.Prisma.PrismaClientValidationError) {
        res.status(500).json({
            message: "Database so'rov validatsiya xatosi",
            code: "PRISMA_VALIDATION_ERROR",
        });
        return;
    }
    // Some Prisma runtime errors may not pass `instanceof` checks after bundling.
    if (typeof err === "object" && err !== null) {
        const maybePrismaError = err;
        if (isPrismaErrorCode(maybePrismaError.code)) {
            res.status(500).json({
                message: "Database xatosi",
                code: maybePrismaError.code,
                details: maybePrismaError.meta ?? null,
            });
            return;
        }
        if (typeof maybePrismaError.name === "string" &&
            maybePrismaError.name.toLowerCase().includes("prisma")) {
            res.status(500).json({
                message: "Database xatosi",
                code: "PRISMA_RUNTIME_ERROR",
                details: typeof maybePrismaError.message === "string"
                    ? maybePrismaError.message
                    : null,
            });
            return;
        }
    }
    console.error(err);
    if (err instanceof Error) {
        res.status(500).json({
            message: "Server ichki xatosi",
            details: err.message,
        });
        return;
    }
    res.status(500).json({ message: "Server ichki xatosi", details: "Noma'lum xatolik" });
};
exports.errorHandler = errorHandler;
