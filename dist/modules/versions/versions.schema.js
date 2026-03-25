"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreVersionParamSchema = exports.noteIdParamSchema = void 0;
const zod_1 = require("zod");
exports.noteIdParamSchema = zod_1.z.object({
    noteId: zod_1.z.string().min(1),
});
exports.restoreVersionParamSchema = zod_1.z.object({
    noteId: zod_1.z.string().min(1),
    versionId: zod_1.z.string().min(1),
});
