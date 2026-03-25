"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceStore = void 0;
class PresenceStore {
    store = new Map();
    join(noteId, presence) {
        const noteMap = this.store.get(noteId) ?? new Map();
        noteMap.set(presence.socketId, presence);
        this.store.set(noteId, noteMap);
        return Array.from(noteMap.values());
    }
    updateCursor(noteId, socketId, cursor) {
        const noteMap = this.store.get(noteId);
        if (!noteMap) {
            return [];
        }
        const existing = noteMap.get(socketId);
        if (existing) {
            noteMap.set(socketId, {
                ...existing,
                cursor,
            });
        }
        return Array.from(noteMap.values());
    }
    leave(noteId, socketId) {
        const noteMap = this.store.get(noteId);
        if (!noteMap) {
            return [];
        }
        noteMap.delete(socketId);
        if (noteMap.size === 0) {
            this.store.delete(noteId);
            return [];
        }
        return Array.from(noteMap.values());
    }
    removeSocketEverywhere(socketId) {
        const changedNotes = [];
        for (const [noteId, noteMap] of this.store.entries()) {
            if (noteMap.delete(socketId)) {
                changedNotes.push(noteId);
            }
            if (noteMap.size === 0) {
                this.store.delete(noteId);
            }
        }
        return changedNotes;
    }
    get(noteId) {
        return Array.from(this.store.get(noteId)?.values() ?? []);
    }
}
exports.PresenceStore = PresenceStore;
