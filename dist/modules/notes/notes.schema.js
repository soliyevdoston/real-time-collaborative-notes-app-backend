"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collaboratorSuggestionQuerySchema = exports.inviteParamSchema = exports.collaboratorParamSchema = exports.addCollaboratorSchema = exports.noteIdParamSchema = exports.updateShareSchema = exports.updateNoteSchema = exports.createNoteSchema = void 0;
const zod_1 = require("zod");
exports.createNoteSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(120),
});
exports.updateNoteSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(120).optional(),
});
exports.updateShareSchema = zod_1.z.object({
    linkAccess: zod_1.z.enum(["RESTRICTED", "ANYONE_WITH_LINK"]),
    linkPermission: zod_1.z.enum(["VIEW", "EDIT"]),
});
exports.noteIdParamSchema = zod_1.z.object({
    noteId: zod_1.z.string().min(1),
});
exports.addCollaboratorSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email(),
});
exports.collaboratorParamSchema = zod_1.z.object({
    noteId: zod_1.z.string().min(1),
    userId: zod_1.z.string().min(1),
});
exports.inviteParamSchema = zod_1.z.object({
    noteId: zod_1.z.string().min(1),
    inviteId: zod_1.z.string().min(1),
});
exports.collaboratorSuggestionQuerySchema = zod_1.z.object({
    query: zod_1.z.string().trim().min(1),
});
