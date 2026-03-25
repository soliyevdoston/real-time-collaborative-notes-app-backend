"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.versionsController = void 0;
const http_error_1 = require("../../shared/errors/http-error");
const notes_service_1 = require("../notes/notes.service");
const getUserId = (req) => {
    if (!req.user) {
        throw new http_error_1.HttpError(401, "Autentifikatsiya talab qilinadi");
    }
    return req.user.id;
};
exports.versionsController = {
    async list(req, res) {
        const versions = await notes_service_1.notesService.listVersions(String(req.params.noteId), getUserId(req));
        res.status(200).json({ versions });
    },
    async restore(req, res) {
        const version = await notes_service_1.notesService.restoreVersion(String(req.params.noteId), String(req.params.versionId), getUserId(req));
        res.status(200).json({ version });
    },
};
