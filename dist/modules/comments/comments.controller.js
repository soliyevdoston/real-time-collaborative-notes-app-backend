"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentsController = void 0;
const http_error_1 = require("../../shared/errors/http-error");
const comments_service_1 = require("./comments.service");
const getUserId = (req) => {
    if (!req.user) {
        throw new http_error_1.HttpError(401, "Autentifikatsiya talab qilinadi");
    }
    return req.user.id;
};
exports.commentsController = {
    async list(req, res) {
        const comments = await comments_service_1.commentsService.list(String(req.params.noteId), getUserId(req));
        res.status(200).json({ comments });
    },
    async create(req, res) {
        const comment = await comments_service_1.commentsService.create(String(req.params.noteId), getUserId(req), req.body.body);
        res.status(201).json({ comment });
    },
    async resolve(req, res) {
        const comment = await comments_service_1.commentsService.resolve(String(req.params.commentId), getUserId(req));
        res.status(200).json({ comment });
    },
};
