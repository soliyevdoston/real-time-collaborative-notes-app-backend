"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentIdParamSchema = exports.createCommentSchema = exports.noteIdParamSchema = void 0;
const zod_1 = require("zod");
exports.noteIdParamSchema = zod_1.z.object({
    noteId: zod_1.z.string().min(1),
});
exports.createCommentSchema = zod_1.z.object({
    body: zod_1.z.string().trim().min(1).max(500),
});
exports.commentIdParamSchema = zod_1.z.object({
    commentId: zod_1.z.string().min(1),
});
