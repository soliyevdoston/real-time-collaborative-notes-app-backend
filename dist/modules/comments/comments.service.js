"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentsService = void 0;
const prisma_1 = require("../../shared/db/prisma");
const http_error_1 = require("../../shared/errors/http-error");
const notes_service_1 = require("../notes/notes.service");
const commentInclude = {
    author: {
        select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
        },
    },
};
exports.commentsService = {
    async list(noteId, userId) {
        const canView = await notes_service_1.notesService.canViewNote(noteId, userId);
        if (!canView) {
            throw new http_error_1.HttpError(403, "Sizda bu hujjat uchun ruxsat yo'q");
        }
        return prisma_1.prisma.comment.findMany({
            where: { noteId },
            include: commentInclude,
            orderBy: { createdAt: "asc" },
        });
    },
    async create(noteId, userId, body) {
        const canEdit = await notes_service_1.notesService.canEditNote(noteId, userId);
        if (!canEdit) {
            throw new http_error_1.HttpError(403, "Sizda komment yozish uchun ruxsat yo'q");
        }
        return prisma_1.prisma.comment.create({
            data: {
                noteId,
                authorId: userId,
                body,
            },
            include: commentInclude,
        });
    },
    async resolve(commentId, userId) {
        const existing = await prisma_1.prisma.comment.findUnique({
            where: { id: commentId },
            select: {
                id: true,
                noteId: true,
            },
        });
        if (!existing) {
            throw new http_error_1.HttpError(404, "Komment topilmadi");
        }
        const canEdit = await notes_service_1.notesService.canEditNote(existing.noteId, userId);
        if (!canEdit) {
            throw new http_error_1.HttpError(403, "Sizda kommentni yopish uchun ruxsat yo'q");
        }
        return prisma_1.prisma.comment.update({
            where: { id: commentId },
            data: {
                resolved: true,
                resolvedAt: new Date(),
            },
            include: commentInclude,
        });
    },
};
