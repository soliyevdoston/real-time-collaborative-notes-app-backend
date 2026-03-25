"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRealtimeDocumentServer = void 0;
const server_1 = require("@hocuspocus/server");
const Y = __importStar(require("yjs"));
const prisma_1 = require("../shared/db/prisma");
const env_1 = require("../shared/config/env");
const jwt_1 = require("../shared/utils/jwt");
const notes_service_1 = require("../modules/notes/notes.service");
const parseToken = (token) => {
    if (!token)
        return null;
    if (token.startsWith("Bearer "))
        return token.slice(7);
    return token;
};
const startRealtimeDocumentServer = async ({ onVersionCreated, }) => {
    const server = new server_1.Server({
        port: env_1.env.HOCUSPOCUS_PORT,
        debounce: 2000,
        maxDebounce: 10000,
        async onAuthenticate({ token, documentName }) {
            const normalizedToken = parseToken(token);
            if (!normalizedToken) {
                throw new Error("Token topilmadi");
            }
            const user = (0, jwt_1.verifyAccessToken)(normalizedToken);
            const accessRole = await notes_service_1.notesService.getAccessRole(documentName, user.sub);
            if (!accessRole) {
                throw new Error("Ruxsat berilmagan");
            }
            return {
                userId: user.sub,
                canEdit: accessRole === "OWNER" || accessRole === "EDITOR",
            };
        },
        async onLoadDocument({ documentName }) {
            const doc = new Y.Doc();
            const note = await prisma_1.prisma.note.findUnique({
                where: { id: documentName },
                select: {
                    ydocState: true,
                },
            });
            if (note?.ydocState) {
                const update = Buffer.from(note.ydocState, "base64");
                Y.applyUpdate(doc, update);
            }
            return doc;
        },
        async onStoreDocument({ documentName, document, context }) {
            const update = Y.encodeStateAsUpdate(document);
            const stateBase64 = Buffer.from(update).toString("base64");
            const version = await notes_service_1.notesService.saveRealtimeState({
                noteId: documentName,
                stateBase64,
                changedById: context?.userId,
            });
            if (version) {
                onVersionCreated(documentName, {
                    id: version.id,
                    createdAt: version.createdAt,
                });
            }
        },
        async onChange({ context }) {
            if (!context?.userId) {
                return;
            }
            if (context.canEdit === false) {
                throw new Error("Bu hujjat siz uchun faqat o'qish rejimida");
            }
        },
    });
    await server.listen();
    return server;
};
exports.startRealtimeDocumentServer = startRealtimeDocumentServer;
