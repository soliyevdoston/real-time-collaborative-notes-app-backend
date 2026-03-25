import bcrypt from "bcryptjs";
import { User } from "@prisma/client";
import { prisma } from "../../shared/db/prisma";
import { HttpError } from "../../shared/errors/http-error";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../shared/utils/jwt";
import { hashToken } from "../../shared/utils/token";
import { env } from "../../shared/config/env";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

const toAuthUser = (user: User): AuthUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
});

const acceptPendingInvites = async (user: User): Promise<void> => {
  const pendingInvites = await prisma.noteInvite.findMany({
    where: {
      invitedEmail: user.email,
      acceptedAt: null,
    },
    select: {
      id: true,
      noteId: true,
      role: true,
    },
  });

  if (pendingInvites.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const invite of pendingInvites) {
      await tx.noteMember.upsert({
        where: {
          noteId_userId: {
            noteId: invite.noteId,
            userId: user.id,
          },
        },
        update: {},
        create: {
          noteId: invite.noteId,
          userId: user.id,
          role: invite.role,
        },
      });
    }

    await tx.noteInvite.updateMany({
      where: {
        id: { in: pendingInvites.map((invite) => invite.id) },
        acceptedAt: null,
      },
      data: {
        acceptedAt: new Date(),
      },
    });
  });
};

const createSession = async (user: User): Promise<AuthSession> => {
  const accessToken = signAccessToken({
    sub: user.id,
    name: user.name,
    email: user.email,
  });

  const refreshToken = signRefreshToken({ sub: user.id });
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  return {
    user: toAuthUser(user),
    accessToken,
    refreshToken,
  };
};

export const authService = {
  async register(input: { name: string; email: string; password: string }): Promise<AuthSession> {
    const email = input.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new HttpError(409, "Bu email allaqachon ro'yxatdan o'tgan");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash,
      },
    });

    await acceptPendingInvites(user);
    return createSession(user);
  },

  async login(input: { email: string; password: string }): Promise<AuthSession> {
    const email = input.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new HttpError(401, "Login yoki parol noto'g'ri");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new HttpError(401, "Login yoki parol noto'g'ri");
    }

    await acceptPendingInvites(user);
    return createSession(user);
  },

  async refresh(rawRefreshToken: string): Promise<AuthSession> {
    const payload = verifyRefreshToken(rawRefreshToken);
    const tokenHash = hashToken(rawRefreshToken);

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      throw new HttpError(401, "Yangilash tokeni yaroqsiz");
    }

    if (tokenRecord.userId !== payload.sub) {
      throw new HttpError(401, "Yangilash tokeni egasi mos kelmadi");
    }

    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    return createSession(tokenRecord.user);
  },

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);

    await prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  async me(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpError(404, "Foydalanuvchi topilmadi");
    }

    return toAuthUser(user);
  },

  async updateProfile(userId: string, input: { name: string }): Promise<AuthUser> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: input.name.trim() },
    });

    return toAuthUser(user);
  },

  async updateAvatar(userId: string, avatarUrl: string): Promise<AuthUser> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return toAuthUser(user);
  },
};
