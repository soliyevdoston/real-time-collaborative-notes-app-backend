"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notesService = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const prisma_1 = require("../../shared/db/prisma");
const http_error_1 = require("../../shared/errors/http-error");
const noteBaseInclude = {
    owner: {
        select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
        },
    },
    members: {
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                },
            },
        },
        orderBy: {
            createdAt: "asc",
        },
    },
    _count: {
        select: {
            comments: true,
            versions: true,
        },
    },
};
const membershipInclude = {
    note: {
        include: noteBaseInclude,
    },
};
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const resolveAccessRoleFromNote = (note, userId) => {
    if (note.ownerId === userId) {
        return "OWNER";
    }
    const member = note.members.find((item) => item.userId === userId);
    if (member?.role === client_1.Role.OWNER) {
        return "OWNER";
    }
    if (member?.role === client_1.Role.EDITOR) {
        return "EDITOR";
    }
    if (note.linkAccess === client_1.LinkAccess.ANYONE_WITH_LINK) {
        if (note.linkPermission === client_1.LinkPermission.EDIT) {
            return "EDITOR";
        }
        return "VIEWER";
    }
    return null;
};
const getMembership = async (noteId, userId) => {
    return prisma_1.prisma.noteMember.findUnique({
        where: {
            noteId_userId: {
                noteId,
                userId,
            },
        },
        include: membershipInclude,
    });
};
const requireMembership = async (noteId, userId) => {
    const membership = await getMembership(noteId, userId);
    if (!membership) {
        throw new http_error_1.HttpError(403, "Sizda bu hujjat uchun ruxsat yo'q");
    }
    return membership;
};
const requireOwner = async (noteId, userId) => {
    const membership = await requireMembership(noteId, userId);
    if (membership.role !== client_1.Role.OWNER) {
        throw new http_error_1.HttpError(403, "Bu amalni faqat hujjat egasi bajara oladi");
    }
    return membership;
};
const requireViewAccess = async (noteId, userId) => {
    const note = await prisma_1.prisma.note.findUnique({
        where: { id: noteId },
        select: {
            ownerId: true,
            linkAccess: true,
            linkPermission: true,
            members: {
                where: { userId },
                select: {
                    userId: true,
                    role: true,
                },
            },
        },
    });
    if (!note) {
        throw new http_error_1.HttpError(404, "Hujjat topilmadi");
    }
    const accessRole = resolveAccessRoleFromNote(note, userId);
    if (!accessRole) {
        throw new http_error_1.HttpError(403, "Sizda bu hujjat uchun ruxsat yo'q");
    }
    return accessRole;
};
exports.notesService = {
    async getAccessRole(noteId, userId) {
        const note = await prisma_1.prisma.note.findUnique({
            where: { id: noteId },
            select: {
                ownerId: true,
                linkAccess: true,
                linkPermission: true,
                members: {
                    where: { userId },
                    select: {
                        userId: true,
                        role: true,
                    },
                },
            },
        });
        if (!note) {
            return null;
        }
        return resolveAccessRoleFromNote(note, userId);
    },
    async createNote(userId, title) {
        const note = await prisma_1.prisma.note.create({
            data: {
                title,
                ownerId: userId,
                members: {
                    create: {
                        userId,
                        role: client_1.Role.OWNER,
                    },
                },
            },
            include: noteBaseInclude,
        });
        return {
            ...note,
            currentAccessRole: "OWNER",
        };
    },
    async listNotes(userId) {
        const notes = await prisma_1.prisma.note.findMany({
            where: {
                members: {
                    some: {
                        userId,
                    },
                },
            },
            include: noteBaseInclude,
            orderBy: {
                updatedAt: "desc",
            },
        });
        return notes.map((note) => ({
            ...note,
            currentAccessRole: note.ownerId === userId ? "OWNER" : "EDITOR",
        }));
    },
    async getNote(noteId, userId) {
        const accessRole = await requireViewAccess(noteId, userId);
        const note = await prisma_1.prisma.note.findUnique({
            where: { id: noteId },
            include: noteBaseInclude,
        });
        if (!note) {
            throw new http_error_1.HttpError(404, "Hujjat topilmadi");
        }
        return {
            ...note,
            currentAccessRole: accessRole,
        };
    },
    async updateNote(noteId, userId, data) {
        const canEdit = await this.canEditNote(noteId, userId);
        if (!canEdit) {
            throw new http_error_1.HttpError(403, "Siz bu hujjatni tahrirlay olmaysiz");
        }
        const note = await prisma_1.prisma.note.update({
            where: { id: noteId },
            data: {
                ...(data.title ? { title: data.title } : {}),
            },
            include: noteBaseInclude,
        });
        const accessRole = await requireViewAccess(noteId, userId);
        return {
            ...note,
            currentAccessRole: accessRole,
        };
    },
    async deleteNote(noteId, userId) {
        await requireOwner(noteId, userId);
        await prisma_1.prisma.note.delete({
            where: { id: noteId },
        });
    },
    async updateShareSettings(noteId, ownerId, input) {
        await requireOwner(noteId, ownerId);
        const note = await prisma_1.prisma.note.update({
            where: { id: noteId },
            data: {
                linkAccess: input.linkAccess,
                linkPermission: input.linkPermission,
            },
            include: noteBaseInclude,
        });
        return {
            ...note,
            currentAccessRole: "OWNER",
        };
    },
    async addCollaborator(noteId, ownerId, email) {
        await requireOwner(noteId, ownerId);
        const normalizedEmail = email.trim().toLowerCase();
        const invitedUser = await prisma_1.prisma.user.findUnique({
            where: {
                email: normalizedEmail,
            },
        });
        if (!invitedUser) {
            await prisma_1.prisma.noteInvite.upsert({
                where: {
                    noteId_invitedEmail: {
                        noteId,
                        invitedEmail: normalizedEmail,
                    },
                },
                update: {
                    invitedById: ownerId,
                    role: client_1.Role.EDITOR,
                    acceptedAt: null,
                },
                create: {
                    noteId,
                    invitedEmail: normalizedEmail,
                    invitedById: ownerId,
                    role: client_1.Role.EDITOR,
                },
            });
            const note = await this.getNote(noteId, ownerId);
            return {
                note,
                delivery: "invited",
                invitedEmail: normalizedEmail,
            };
        }
        if (invitedUser.id === ownerId) {
            throw new http_error_1.HttpError(400, "Hujjat egasi bu hujjatga allaqachon kirish huquqiga ega");
        }
        const existingMembership = await prisma_1.prisma.noteMember.findUnique({
            where: {
                noteId_userId: {
                    noteId,
                    userId: invitedUser.id,
                },
            },
        });
        if (existingMembership) {
            throw new http_error_1.HttpError(409, "Bu foydalanuvchi allaqachon hamkor");
        }
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.noteMember.create({
                data: {
                    noteId,
                    userId: invitedUser.id,
                    role: client_1.Role.EDITOR,
                },
            }),
            prisma_1.prisma.noteInvite.deleteMany({
                where: {
                    noteId,
                    invitedEmail: normalizedEmail,
                },
            }),
        ]);
        const note = await this.getNote(noteId, ownerId);
        return {
            note,
            targetUserId: invitedUser.id,
            delivery: "added",
            invitedEmail: normalizedEmail,
        };
    },
    async suggestCollaborators(noteId, ownerId, query) {
        await requireOwner(noteId, ownerId);
        const searchQuery = query.trim();
        if (searchQuery.length < 2) {
            return [];
        }
        const memberships = await prisma_1.prisma.noteMember.findMany({
            where: { noteId },
            select: { userId: true },
        });
        const pendingInvites = await prisma_1.prisma.noteInvite.findMany({
            where: {
                noteId,
                acceptedAt: null,
            },
            select: {
                invitedEmail: true,
            },
        });
        const excludedUserIds = memberships.map((membership) => membership.userId);
        const excludedEmails = pendingInvites.map((invite) => invite.invitedEmail);
        return prisma_1.prisma.user.findMany({
            where: {
                id: {
                    notIn: excludedUserIds,
                },
                email: {
                    notIn: excludedEmails,
                },
                OR: [
                    {
                        email: {
                            contains: searchQuery,
                            mode: "insensitive",
                        },
                    },
                    {
                        name: {
                            contains: searchQuery,
                            mode: "insensitive",
                        },
                    },
                ],
            },
            select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
            },
            orderBy: [{ email: "asc" }],
            take: 8,
        });
    },
    async removeCollaborator(noteId, ownerId, collaboratorId) {
        await requireOwner(noteId, ownerId);
        if (ownerId === collaboratorId) {
            throw new http_error_1.HttpError(400, "Hujjat egasi o'zini o'zi olib tashlay olmaydi");
        }
        const existingMembership = await prisma_1.prisma.noteMember.findUnique({
            where: {
                noteId_userId: {
                    noteId,
                    userId: collaboratorId,
                },
            },
        });
        if (!existingMembership) {
            throw new http_error_1.HttpError(404, "Bu hujjat ichida hamkor topilmadi");
        }
        await prisma_1.prisma.noteMember.delete({
            where: {
                noteId_userId: {
                    noteId,
                    userId: collaboratorId,
                },
            },
        });
        const note = await this.getNote(noteId, ownerId);
        return {
            note,
            targetUserId: collaboratorId,
        };
    },
    async listInvites(noteId, ownerId) {
        await requireOwner(noteId, ownerId);
        return prisma_1.prisma.noteInvite.findMany({
            where: {
                noteId,
                acceptedAt: null,
            },
            select: {
                id: true,
                invitedEmail: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: "asc",
            },
        });
    },
    async removeInvite(noteId, ownerId, inviteId) {
        await requireOwner(noteId, ownerId);
        const deleted = await prisma_1.prisma.noteInvite.deleteMany({
            where: {
                id: inviteId,
                noteId,
                acceptedAt: null,
            },
        });
        if (deleted.count === 0) {
            throw new http_error_1.HttpError(404, "Taklif topilmadi");
        }
    },
    async canViewNote(noteId, userId) {
        const role = await this.getAccessRole(noteId, userId);
        return Boolean(role);
    },
    async canEditNote(noteId, userId) {
        const role = await this.getAccessRole(noteId, userId);
        return role === "OWNER" || role === "EDITOR";
    },
    async saveRealtimeState(params) {
        const { noteId, stateBase64, changedById } = params;
        if (changedById) {
            const canEdit = await this.canEditNote(noteId, changedById);
            if (!canEdit) {
                return null;
            }
        }
        const stateHash = sha256(stateBase64);
        const note = await prisma_1.prisma.note.findUnique({
            where: { id: noteId },
            select: {
                id: true,
                ydocStateHash: true,
                lastVersionAt: true,
            },
        });
        if (!note) {
            throw new http_error_1.HttpError(404, "Real-time holatni saqlash uchun hujjat topilmadi");
        }
        const now = new Date();
        const changed = note.ydocStateHash !== stateHash;
        const canSnapshot = changed &&
            (!note.lastVersionAt || now.getTime() - note.lastVersionAt.getTime() >= 30_000);
        await prisma_1.prisma.note.update({
            where: { id: noteId },
            data: {
                ydocState: stateBase64,
                ydocStateHash: stateHash,
                ...(canSnapshot ? { lastVersionAt: now } : {}),
            },
        });
        if (!canSnapshot) {
            return null;
        }
        const version = await prisma_1.prisma.noteVersion.create({
            data: {
                noteId,
                state: stateBase64,
                createdById: changedById,
            },
        });
        const oldVersions = await prisma_1.prisma.noteVersion.findMany({
            where: { noteId },
            orderBy: { createdAt: "desc" },
            skip: 5,
            select: { id: true },
        });
        if (oldVersions.length > 0) {
            await prisma_1.prisma.noteVersion.deleteMany({
                where: {
                    id: {
                        in: oldVersions.map((item) => item.id),
                    },
                },
            });
        }
        return version;
    },
    async listVersions(noteId, userId) {
        const canView = await this.canViewNote(noteId, userId);
        if (!canView) {
            throw new http_error_1.HttpError(403, "Sizda bu hujjat versiyalarini ko'rish uchun ruxsat yo'q");
        }
        return prisma_1.prisma.noteVersion.findMany({
            where: { noteId },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 5,
        });
    },
    async restoreVersion(noteId, versionId, userId) {
        const canEdit = await this.canEditNote(noteId, userId);
        if (!canEdit) {
            throw new http_error_1.HttpError(403, "Siz bu hujjat versiyasini qaytara olmaysiz");
        }
        const version = await prisma_1.prisma.noteVersion.findFirst({
            where: {
                id: versionId,
                noteId,
            },
        });
        if (!version) {
            throw new http_error_1.HttpError(404, "Versiya topilmadi");
        }
        await prisma_1.prisma.note.update({
            where: { id: noteId },
            data: {
                ydocState: version.state,
                ydocStateHash: sha256(version.state),
                lastVersionAt: new Date(),
            },
        });
        return version;
    },
};
