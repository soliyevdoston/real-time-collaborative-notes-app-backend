"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notesController = void 0;
const http_error_1 = require("../../shared/errors/http-error");
const notes_service_1 = require("./notes.service");
const getUserId = (req) => {
    if (!req.user) {
        throw new http_error_1.HttpError(401, "Autentifikatsiya talab qilinadi");
    }
    return req.user.id;
};
exports.notesController = {
    async create(req, res) {
        const note = await notes_service_1.notesService.createNote(getUserId(req), req.body.title);
        res.status(201).json({ note });
    },
    async list(req, res) {
        const notes = await notes_service_1.notesService.listNotes(getUserId(req));
        res.status(200).json({ notes });
    },
    async getById(req, res) {
        const note = await notes_service_1.notesService.getNote(String(req.params.noteId), getUserId(req));
        res.status(200).json({ note });
    },
    async update(req, res) {
        const note = await notes_service_1.notesService.updateNote(String(req.params.noteId), getUserId(req), req.body);
        res.status(200).json({ note });
    },
    async updateShare(req, res) {
        const note = await notes_service_1.notesService.updateShareSettings(String(req.params.noteId), getUserId(req), req.body);
        const realtimeGateway = req.app.get("realtimeGateway");
        await realtimeGateway?.emitShareSettingsChanged(String(req.params.noteId));
        res.status(200).json({ note });
    },
    async remove(req, res) {
        await notes_service_1.notesService.deleteNote(String(req.params.noteId), getUserId(req));
        res.status(204).send();
    },
    async addCollaborator(req, res) {
        const result = await notes_service_1.notesService.addCollaborator(String(req.params.noteId), getUserId(req), req.body.email);
        const realtimeGateway = req.app.get("realtimeGateway");
        if (result.delivery === "added" && result.targetUserId) {
            realtimeGateway?.emitCollaboratorChanged({
                noteId: String(req.params.noteId),
                actorId: getUserId(req),
                targetUserId: result.targetUserId,
                action: "added",
            });
        }
        res.status(200).json({
            note: result.note,
            delivery: result.delivery,
            invitedEmail: result.invitedEmail ?? null,
        });
    },
    async suggestCollaborators(req, res) {
        const users = await notes_service_1.notesService.suggestCollaborators(String(req.params.noteId), getUserId(req), String(req.query.query ?? ""));
        res.status(200).json({ users });
    },
    async removeCollaborator(req, res) {
        const result = await notes_service_1.notesService.removeCollaborator(String(req.params.noteId), getUserId(req), String(req.params.userId));
        const realtimeGateway = req.app.get("realtimeGateway");
        realtimeGateway?.emitCollaboratorChanged({
            noteId: String(req.params.noteId),
            actorId: getUserId(req),
            targetUserId: result.targetUserId,
            action: "removed",
        });
        res.status(200).json({ note: result.note });
    },
    async listInvites(req, res) {
        const invites = await notes_service_1.notesService.listInvites(String(req.params.noteId), getUserId(req));
        res.status(200).json({ invites });
    },
    async removeInvite(req, res) {
        await notes_service_1.notesService.removeInvite(String(req.params.noteId), getUserId(req), String(req.params.inviteId));
        res.status(204).send();
    },
};
