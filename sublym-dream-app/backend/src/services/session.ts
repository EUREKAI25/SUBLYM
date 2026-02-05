import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';

const SESSION_EXPIRY_DAYS = parseInt(process.env.SESSION_EXPIRY_DAYS || '30', 10);

export async function createSession(
  userId: string,
  userAgent?: string | null,
  ip?: string | null
) {
  const token = nanoid(64);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      userAgent: userAgent || null,
      ip: ip || null,
    },
  });

  return session;
}

export async function verifySession(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  if (session.user.status !== 'active' || session.user.deletedAt) {
    return null;
  }

  return session;
}

export async function revokeSession(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      id: exceptSessionId ? { not: exceptSessionId } : undefined,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}
