"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const env_1 = require("../../shared/config/env");
const http_error_1 = require("../../shared/errors/http-error");
const auth_service_1 = require("./auth.service");
const REFRESH_COOKIE = "refreshToken";
const setRefreshCookie = (res, refreshToken) => {
    res.cookie(REFRESH_COOKIE, refreshToken, {
        httpOnly: true,
        secure: env_1.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth",
        maxAge: env_1.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
};
const clearRefreshCookie = (res) => {
    res.clearCookie(REFRESH_COOKIE, {
        path: "/api/auth",
    });
};
exports.authController = {
    async register(req, res) {
        const session = await auth_service_1.authService.register(req.body);
        setRefreshCookie(res, session.refreshToken);
        res.status(201).json({
            user: session.user,
            accessToken: session.accessToken,
        });
    },
    async login(req, res) {
        const session = await auth_service_1.authService.login(req.body);
        setRefreshCookie(res, session.refreshToken);
        res.status(200).json({
            user: session.user,
            accessToken: session.accessToken,
        });
    },
    async refresh(req, res) {
        const refreshToken = req.cookies[REFRESH_COOKIE];
        if (!refreshToken) {
            throw new http_error_1.HttpError(401, "Yangilash tokeni topilmadi");
        }
        const session = await auth_service_1.authService.refresh(refreshToken);
        setRefreshCookie(res, session.refreshToken);
        res.status(200).json({
            user: session.user,
            accessToken: session.accessToken,
        });
    },
    async logout(req, res) {
        const refreshToken = req.cookies[REFRESH_COOKIE];
        if (refreshToken) {
            await auth_service_1.authService.revokeRefreshToken(refreshToken);
        }
        clearRefreshCookie(res);
        res.status(200).json({ message: "Tizimdan chiqildi" });
    },
    async me(req, res) {
        if (!req.user) {
            throw new http_error_1.HttpError(401, "Autentifikatsiya talab qilinadi");
        }
        const user = await auth_service_1.authService.me(req.user.id);
        res.status(200).json({ user });
    },
    async updateProfile(req, res) {
        if (!req.user) {
            throw new http_error_1.HttpError(401, "Autentifikatsiya talab qilinadi");
        }
        const user = await auth_service_1.authService.updateProfile(req.user.id, req.body);
        res.status(200).json({ user });
    },
    async uploadAvatar(req, res) {
        if (!req.user) {
            throw new http_error_1.HttpError(401, "Autentifikatsiya talab qilinadi");
        }
        if (!req.file) {
            throw new http_error_1.HttpError(400, "Avatar rasmi topilmadi");
        }
        const avatarPath = "/uploads/avatars/" + req.file.filename;
        const avatarUrl = env_1.env.BACKEND_PUBLIC_URL.replace(/\/$/, "") + avatarPath;
        const user = await auth_service_1.authService.updateAvatar(req.user.id, avatarUrl);
        res.status(200).json({ user });
    },
};
