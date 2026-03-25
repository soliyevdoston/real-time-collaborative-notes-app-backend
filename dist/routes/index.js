"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const auth_routes_1 = require("../modules/auth/auth.routes");
const notes_routes_1 = require("../modules/notes/notes.routes");
const comments_routes_1 = require("../modules/comments/comments.routes");
const versions_routes_1 = require("../modules/versions/versions.routes");
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "real-time-collaborative-notes-app-backend" });
});
exports.apiRouter.use("/auth", auth_routes_1.authRouter);
exports.apiRouter.use("/notes", notes_routes_1.notesRouter);
exports.apiRouter.use("/notes", comments_routes_1.noteCommentsRouter);
exports.apiRouter.use("/notes", versions_routes_1.versionsRouter);
exports.apiRouter.use("/comments", comments_routes_1.commentsRouter);
