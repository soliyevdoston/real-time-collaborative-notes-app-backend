"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpServer = exports.createRealtimeSocketServer = void 0;
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const comments_service_1 = require("../modules/comments/comments.service");
const presence_store_1 = require("../modules/presence/presence.store");
const notes_service_1 = require("../modules/notes/notes.service");
const env_1 = require("../shared/config/env");
const jwt_1 = require("../shared/utils/jwt");
const noteRoom = (noteId) => `note:${noteId}`;
const parseToken = (raw) => {
    if (!raw)
        return null;
    if (raw.startsWith("Bearer "))
        return raw.slice(7);
    return raw;
};
const createRealtimeSocketServer = (httpServer) => {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: env_1.env.FRONTEND_URL,
            credentials: true,
        },
    });
    const presenceStore = new presence_store_1.PresenceStore();
    const socketsByUserId = new Map();
    const registerUserSocket = (userId, socketId) => {
        const current = socketsByUserId.get(userId) ?? new Set();
        current.add(socketId);
        socketsByUserId.set(userId, current);
    };
    const unregisterUserSocket = (userId, socketId) => {
        const current = socketsByUserId.get(userId);
        if (!current) {
            return;
        }
        current.delete(socketId);
        if (current.size === 0) {
            socketsByUserId.delete(userId);
        }
    };
    const forceLeaveNoteRoom = (noteId, userId) => {
        const socketIds = socketsByUserId.get(userId);
        if (!socketIds || socketIds.size === 0) {
            return;
        }
        for (const socketId of socketIds) {
            const socket = io.sockets.sockets.get(socketId);
            if (!socket) {
                continue;
            }
            socket.leave(noteRoom(noteId));
            socket.data.activeNotes.delete(noteId);
            socket.emit("collaboration:access-removed", { noteId });
            presenceStore.leave(noteId, socket.id);
        }
        io.to(noteRoom(noteId)).emit("presence:update", {
            noteId,
            users: presenceStore.get(noteId),
        });
    };
    const reconcileNoteRoomPermissions = async (noteId) => {
        const room = io.sockets.adapter.rooms.get(noteRoom(noteId));
        if (!room || room.size === 0) {
            return;
        }
        for (const socketId of room) {
            const socket = io.sockets.sockets.get(socketId);
            if (!socket) {
                continue;
            }
            const socketUser = socket.data.user;
            if (!socketUser) {
                continue;
            }
            const canView = await notes_service_1.notesService.canViewNote(noteId, socketUser.id);
            if (canView) {
                continue;
            }
            socket.leave(noteRoom(noteId));
            socket.data.activeNotes.delete(noteId);
            socket.emit("collaboration:access-removed", { noteId });
            presenceStore.leave(noteId, socket.id);
        }
        io.to(noteRoom(noteId)).emit("presence:update", {
            noteId,
            users: presenceStore.get(noteId),
        });
    };
    io.use((socket, next) => {
        try {
            const authToken = parseToken(socket.handshake.auth?.token) ||
                parseToken(socket.handshake.headers.authorization);
            if (!authToken) {
                next(new Error("Ruxsat berilmagan"));
                return;
            }
            const payload = (0, jwt_1.verifyAccessToken)(authToken);
            socket.data.user = {
                id: payload.sub,
                name: payload.name,
                email: payload.email,
            };
            socket.data.activeNotes = new Set();
            next();
        }
        catch (_error) {
            next(new Error("Ruxsat berilmagan"));
        }
    });
    io.on("connection", (socket) => {
        const user = socket.data.user;
        registerUserSocket(user.id, socket.id);
        socket.on("presence:join", async (payload) => {
            const canView = await notes_service_1.notesService.canViewNote(payload.noteId, user.id);
            if (!canView) {
                socket.emit("error:permission", { message: "Bu hujjat uchun ruxsat yo'q" });
                return;
            }
            socket.join(noteRoom(payload.noteId));
            socket.data.activeNotes.add(payload.noteId);
            const users = presenceStore.join(payload.noteId, {
                userId: user.id,
                name: user.name,
                color: payload.color ?? "#0f766e",
                socketId: socket.id,
            });
            io.to(noteRoom(payload.noteId)).emit("presence:update", {
                noteId: payload.noteId,
                users,
            });
        });
        socket.on("presence:cursor", (payload) => {
            if (!socket.data.activeNotes.has(payload.noteId)) {
                return;
            }
            const users = presenceStore.updateCursor(payload.noteId, socket.id, {
                from: payload.from,
                to: payload.to,
            });
            io.to(noteRoom(payload.noteId)).emit("presence:update", {
                noteId: payload.noteId,
                users,
            });
        });
        socket.on("presence:leave", (payload) => {
            socket.leave(noteRoom(payload.noteId));
            socket.data.activeNotes.delete(payload.noteId);
            const users = presenceStore.leave(payload.noteId, socket.id);
            io.to(noteRoom(payload.noteId)).emit("presence:update", {
                noteId: payload.noteId,
                users,
            });
        });
        socket.on("comment:create", async (payload) => {
            const comment = await comments_service_1.commentsService.create(payload.noteId, user.id, payload.body);
            io.to(noteRoom(payload.noteId)).emit("comment:created", { noteId: payload.noteId, comment });
        });
        socket.on("comment:resolve", async (payload) => {
            const comment = await comments_service_1.commentsService.resolve(payload.commentId, user.id);
            io.to(noteRoom(comment.noteId)).emit("comment:resolved", {
                noteId: comment.noteId,
                comment,
            });
        });
        socket.on("disconnect", () => {
            unregisterUserSocket(user.id, socket.id);
            const affectedNotes = presenceStore.removeSocketEverywhere(socket.id);
            for (const noteId of affectedNotes) {
                io.to(noteRoom(noteId)).emit("presence:update", {
                    noteId,
                    users: presenceStore.get(noteId),
                });
            }
        });
    });
    const emitVersionCreated = (noteId, version) => {
        io.to(noteRoom(noteId)).emit("version:created", {
            noteId,
            version,
        });
    };
    const emitCollaboratorChanged = (event) => {
        io.to(noteRoom(event.noteId)).emit("collaborator:changed", event);
        if (event.action === "removed") {
            forceLeaveNoteRoom(event.noteId, event.targetUserId);
        }
    };
    const emitShareSettingsChanged = async (noteId) => {
        await reconcileNoteRoomPermissions(noteId);
        io.to(noteRoom(noteId)).emit("share:updated", { noteId });
    };
    return {
        io,
        emitVersionCreated,
        emitCollaboratorChanged,
        emitShareSettingsChanged,
    };
};
exports.createRealtimeSocketServer = createRealtimeSocketServer;
exports.createHttpServer = http_1.createServer;
