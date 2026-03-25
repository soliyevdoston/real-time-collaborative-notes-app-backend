import { LinkAccess, LinkPermission, Role } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "../../shared/db/prisma";
import { HttpError } from "../../shared/errors/http-error";

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
      createdAt: "asc" as const,
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

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

type AccessRole = "OWNER" | "EDITOR" | "VIEWER";

const resolveAccessRoleFromNote = (
  note: {
    ownerId: string;
    linkAccess: LinkAccess;
    linkPermission: LinkPermission;
    members: Array<{ userId: string; role: Role }>;
  },
  userId: string,
): AccessRole | null => {
  if (note.ownerId === userId) {
    return "OWNER";
  }

  const member = note.members.find((item) => item.userId === userId);
  if (member?.role === Role.OWNER) {
    return "OWNER";
  }

  if (member?.role === Role.EDITOR) {
    return "EDITOR";
  }

  if (note.linkAccess === LinkAccess.ANYONE_WITH_LINK) {
    if (note.linkPermission === LinkPermission.EDIT) {
      return "EDITOR";
    }

    return "VIEWER";
  }

  return null;
};

const getMembership = async (noteId: string, userId: string) => {
  return prisma.noteMember.findUnique({
    where: {
      noteId_userId: {
        noteId,
        userId,
      },
    },
    include: membershipInclude,
  });
};

const requireMembership = async (noteId: string, userId: string) => {
  const membership = await getMembership(noteId, userId);
  if (!membership) {
    throw new HttpError(403, "Sizda bu hujjat uchun ruxsat yo'q");
  }

  return membership;
};

const requireOwner = async (noteId: string, userId: string) => {
  const membership = await requireMembership(noteId, userId);
  if (membership.role !== Role.OWNER) {
    throw new HttpError(403, "Bu amalni faqat hujjat egasi bajara oladi");
  }

  return membership;
};

const requireViewAccess = async (noteId: string, userId: string): Promise<AccessRole> => {
  const note = await prisma.note.findUnique({
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
    throw new HttpError(404, "Hujjat topilmadi");
  }

  const accessRole = resolveAccessRoleFromNote(note, userId);
  if (!accessRole) {
    throw new HttpError(403, "Sizda bu hujjat uchun ruxsat yo'q");
  }

  return accessRole;
};

export const notesService = {
  async getAccessRole(noteId: string, userId: string): Promise<AccessRole | null> {
    const note = await prisma.note.findUnique({
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

  async createNote(userId: string, title: string) {
    const note = await prisma.note.create({
      data: {
        title,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: Role.OWNER,
          },
        },
      },
      include: noteBaseInclude,
    });

    return {
      ...note,
      currentAccessRole: "OWNER" as const,
    };
  },

  async listNotes(userId: string) {
    const notes = await prisma.note.findMany({
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
      currentAccessRole: note.ownerId === userId ? ("OWNER" as const) : ("EDITOR" as const),
    }));
  },

  async getNote(noteId: string, userId: string) {
    const accessRole = await requireViewAccess(noteId, userId);
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      include: noteBaseInclude,
    });

    if (!note) {
      throw new HttpError(404, "Hujjat topilmadi");
    }

    return {
      ...note,
      currentAccessRole: accessRole,
    };
  },

  async updateNote(noteId: string, userId: string, data: { title?: string }) {
    const canEdit = await this.canEditNote(noteId, userId);
    if (!canEdit) {
      throw new HttpError(403, "Siz bu hujjatni tahrirlay olmaysiz");
    }

    const note = await prisma.note.update({
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

  async deleteNote(noteId: string, userId: string) {
    await requireOwner(noteId, userId);

    await prisma.note.delete({
      where: { id: noteId },
    });
  },

  async updateShareSettings(
    noteId: string,
    ownerId: string,
    input: { linkAccess: LinkAccess; linkPermission: LinkPermission },
  ) {
    await requireOwner(noteId, ownerId);

    const note = await prisma.note.update({
      where: { id: noteId },
      data: {
        linkAccess: input.linkAccess,
        linkPermission: input.linkPermission,
      },
      include: noteBaseInclude,
    });

    return {
      ...note,
      currentAccessRole: "OWNER" as const,
    };
  },

  async addCollaborator(noteId: string, ownerId: string, email: string) {
    await requireOwner(noteId, ownerId);

    const normalizedEmail = email.trim().toLowerCase();
    const invitedUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!invitedUser) {
      await prisma.noteInvite.upsert({
        where: {
          noteId_invitedEmail: {
            noteId,
            invitedEmail: normalizedEmail,
          },
        },
        update: {
          invitedById: ownerId,
          role: Role.EDITOR,
          acceptedAt: null,
        },
        create: {
          noteId,
          invitedEmail: normalizedEmail,
          invitedById: ownerId,
          role: Role.EDITOR,
        },
      });

      const note = await this.getNote(noteId, ownerId);
      return {
        note,
        delivery: "invited" as const,
        invitedEmail: normalizedEmail,
      };
    }

    if (invitedUser.id === ownerId) {
      throw new HttpError(400, "Hujjat egasi bu hujjatga allaqachon kirish huquqiga ega");
    }

    const existingMembership = await prisma.noteMember.findUnique({
      where: {
        noteId_userId: {
          noteId,
          userId: invitedUser.id,
        },
      },
    });

    if (existingMembership) {
      throw new HttpError(409, "Bu foydalanuvchi allaqachon hamkor");
    }

    await prisma.$transaction([
      prisma.noteMember.create({
        data: {
          noteId,
          userId: invitedUser.id,
          role: Role.EDITOR,
        },
      }),
      prisma.noteInvite.deleteMany({
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
      delivery: "added" as const,
      invitedEmail: normalizedEmail,
    };
  },

  async suggestCollaborators(noteId: string, ownerId: string, query: string) {
    await requireOwner(noteId, ownerId);

    const searchQuery = query.trim();
    if (searchQuery.length < 2) {
      return [];
    }

    const memberships = await prisma.noteMember.findMany({
      where: { noteId },
      select: { userId: true },
    });
    const pendingInvites = await prisma.noteInvite.findMany({
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

    return prisma.user.findMany({
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

  async removeCollaborator(noteId: string, ownerId: string, collaboratorId: string) {
    await requireOwner(noteId, ownerId);

    if (ownerId === collaboratorId) {
      throw new HttpError(400, "Hujjat egasi o'zini o'zi olib tashlay olmaydi");
    }

    const existingMembership = await prisma.noteMember.findUnique({
      where: {
        noteId_userId: {
          noteId,
          userId: collaboratorId,
        },
      },
    });

    if (!existingMembership) {
      throw new HttpError(404, "Bu hujjat ichida hamkor topilmadi");
    }

    await prisma.noteMember.delete({
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

  async listInvites(noteId: string, ownerId: string) {
    await requireOwner(noteId, ownerId);

    return prisma.noteInvite.findMany({
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

  async removeInvite(noteId: string, ownerId: string, inviteId: string) {
    await requireOwner(noteId, ownerId);

    const deleted = await prisma.noteInvite.deleteMany({
      where: {
        id: inviteId,
        noteId,
        acceptedAt: null,
      },
    });

    if (deleted.count === 0) {
      throw new HttpError(404, "Taklif topilmadi");
    }
  },

  async canViewNote(noteId: string, userId: string): Promise<boolean> {
    const role = await this.getAccessRole(noteId, userId);
    return Boolean(role);
  },

  async canEditNote(noteId: string, userId: string): Promise<boolean> {
    const role = await this.getAccessRole(noteId, userId);
    return role === "OWNER" || role === "EDITOR";
  },

  async saveRealtimeState(params: {
    noteId: string;
    stateBase64: string;
    changedById?: string;
  }) {
    const { noteId, stateBase64, changedById } = params;

    if (changedById) {
      const canEdit = await this.canEditNote(noteId, changedById);
      if (!canEdit) {
        return null;
      }
    }

    const stateHash = sha256(stateBase64);

    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        ydocStateHash: true,
        lastVersionAt: true,
      },
    });

    if (!note) {
      throw new HttpError(404, "Real-time holatni saqlash uchun hujjat topilmadi");
    }

    const now = new Date();
    const changed = note.ydocStateHash !== stateHash;
    const canSnapshot =
      changed &&
      (!note.lastVersionAt || now.getTime() - note.lastVersionAt.getTime() >= 30_000);

    await prisma.note.update({
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

    const version = await prisma.noteVersion.create({
      data: {
        noteId,
        state: stateBase64,
        createdById: changedById,
      },
    });

    const oldVersions = await prisma.noteVersion.findMany({
      where: { noteId },
      orderBy: { createdAt: "desc" },
      skip: 5,
      select: { id: true },
    });

    if (oldVersions.length > 0) {
      await prisma.noteVersion.deleteMany({
        where: {
          id: {
            in: oldVersions.map((item) => item.id),
          },
        },
      });
    }

    return version;
  },

  async listVersions(noteId: string, userId: string) {
    const canView = await this.canViewNote(noteId, userId);
    if (!canView) {
      throw new HttpError(403, "Sizda bu hujjat versiyalarini ko'rish uchun ruxsat yo'q");
    }

    return prisma.noteVersion.findMany({
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

  async restoreVersion(noteId: string, versionId: string, userId: string) {
    const canEdit = await this.canEditNote(noteId, userId);
    if (!canEdit) {
      throw new HttpError(403, "Siz bu hujjat versiyasini qaytara olmaysiz");
    }

    const version = await prisma.noteVersion.findFirst({
      where: {
        id: versionId,
        noteId,
      },
    });

    if (!version) {
      throw new HttpError(404, "Versiya topilmadi");
    }

    await prisma.note.update({
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
