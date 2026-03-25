"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../../shared/db/prisma");
const http_error_1 = require("../../shared/errors/http-error");
const jwt_1 = require("../../shared/utils/jwt");
const token_1 = require("../../shared/utils/token");
const env_1 = require("../../shared/config/env");
const toAuthUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
});
const acceptPendingInvites = async (user) => {
    const pendingInvites = await prisma_1.prisma.noteInvite.findMany({
        where: {
            invitedEmail: user.email,
            acceptedAt: null,
        },
        select: {
            id: true,
            noteId: true,
            role: true,
        },
    });
    if (pendingInvites.length === 0) {
        return;
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        for (const invite of pendingInvites) {
            await tx.noteMember.upsert({
                where: {
                    noteId_userId: {
                        noteId: invite.noteId,
                        userId: user.id,
                    },
                },
                update: {},
                create: {
                    noteId: invite.noteId,
                    userId: user.id,
                    role: invite.role,
                },
            });
        }
        await tx.noteInvite.updateMany({
            where: {
                id: { in: pendingInvites.map((invite) => invite.id) },
                acceptedAt: null,
            },
            data: {
                acceptedAt: new Date(),
            },
        });
    });
};
const createSession = async (user) => {
    const accessToken = (0, jwt_1.signAccessToken)({
        sub: user.id,
        name: user.name,
        email: user.email,
    });
    const refreshToken = (0, jwt_1.signRefreshToken)({ sub: user.id });
    const tokenHash = (0, token_1.hashToken)(refreshToken);
    const expiresAt = new Date(Date.now() + env_1.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await prisma_1.prisma.refreshToken.create({
        data: {
            userId: user.id,
            tokenHash,
            expiresAt,
        },
    });
    return {
        user: toAuthUser(user),
        accessToken,
        refreshToken,
    };
};
exports.authService = {
    async register(input) {
        const email = input.email.toLowerCase();
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new http_error_1.HttpError(409, "Bu email allaqachon ro'yxatdan o'tgan");
        }
        const passwordHash = await bcryptjs_1.default.hash(input.password, 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                name: input.name,
                email,
                passwordHash,
            },
        });
        await acceptPendingInvites(user);
        return createSession(user);
    },
    async login(input) {
        const email = input.email.toLowerCase();
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new http_error_1.HttpError(401, "Login yoki parol noto'g'ri");
        }
        const passwordMatches = await bcryptjs_1.default.compare(input.password, user.passwordHash);
        if (!passwordMatches) {
            throw new http_error_1.HttpError(401, "Login yoki parol noto'g'ri");
        }
        await acceptPendingInvites(user);
        return createSession(user);
    },
    async refresh(rawRefreshToken) {
        const payload = (0, jwt_1.verifyRefreshToken)(rawRefreshToken);
        const tokenHash = (0, token_1.hashToken)(rawRefreshToken);
        const tokenRecord = await prisma_1.prisma.refreshToken.findUnique({
            where: { tokenHash },
            include: { user: true },
        });
        if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
            throw new http_error_1.HttpError(401, "Yangilash tokeni yaroqsiz");
        }
        if (tokenRecord.userId !== payload.sub) {
            throw new http_error_1.HttpError(401, "Yangilash tokeni egasi mos kelmadi");
        }
        await prisma_1.prisma.refreshToken.update({
            where: { id: tokenRecord.id },
            data: { revokedAt: new Date() },
        });
        return createSession(tokenRecord.user);
    },
    async revokeRefreshToken(rawRefreshToken) {
        const tokenHash = (0, token_1.hashToken)(rawRefreshToken);
        await prisma_1.prisma.refreshToken.updateMany({
            where: {
                tokenHash,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
    },
    async me(userId) {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new http_error_1.HttpError(404, "Foydalanuvchi topilmadi");
        }
        return toAuthUser(user);
    },
    async updateProfile(userId, input) {
        const user = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { name: input.name.trim() },
        });
        return toAuthUser(user);
    },
    async updateAvatar(userId, avatarUrl) {
        const user = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { avatarUrl },
        });
        return toAuthUser(user);
    },
};
