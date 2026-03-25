"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const http_error_1 = require("../errors/http-error");
const jwt_1 = require("../utils/jwt");
const parseBearerToken = (header) => {
    if (!header || !header.startsWith("Bearer ")) {
        return null;
    }
    return header.slice(7);
};
const requireAuth = (req, _res, next) => {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
        next(new http_error_1.HttpError(401, "Autentifikatsiya talab qilinadi"));
        return;
    }
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.user = {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
        };
        next();
    }
    catch (_error) {
        next(new http_error_1.HttpError(401, "Kirish tokeni noto'g'ri yoki muddati tugagan"));
    }
};
exports.requireAuth = requireAuth;
