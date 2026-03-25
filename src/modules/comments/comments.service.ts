import { prisma } from "../../shared/db/prisma";
import { HttpError } from "../../shared/errors/http-error";
import { notesService } from "../notes/notes.service";

const commentInclude = {
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  },
};

export const commentsService = {
  async list(noteId: string, userId: string) {
    const canView = await notesService.canViewNote(noteId, userId);
    if (!canView) {
      throw new HttpError(403, "Sizda bu hujjat uchun ruxsat yo'q");
    }

    return prisma.comment.findMany({
      where: { noteId },
      include: commentInclude,
      orderBy: { createdAt: "asc" },
    });
  },

  async create(noteId: string, userId: string, body: string) {
    const canEdit = await notesService.canEditNote(noteId, userId);
    if (!canEdit) {
      throw new HttpError(403, "Sizda komment yozish uchun ruxsat yo'q");
    }

    return prisma.comment.create({
      data: {
        noteId,
        authorId: userId,
        body,
      },
      include: commentInclude,
    });
  },

  async resolve(commentId: string, userId: string) {
    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        noteId: true,
      },
    });

    if (!existing) {
      throw new HttpError(404, "Komment topilmadi");
    }

    const canEdit = await notesService.canEditNote(existing.noteId, userId);
    if (!canEdit) {
      throw new HttpError(403, "Sizda kommentni yopish uchun ruxsat yo'q");
    }

    return prisma.comment.update({
      where: { id: commentId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      },
      include: commentInclude,
    });
  },
};
