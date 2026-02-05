import { Context, Next } from 'hono';
import { prisma } from '../lib/prisma.js';

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Non autorisé' }, 401);
  }

  const token = authHeader.substring(7);

  // Find session
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    return c.json({ error: 'Session invalide' }, 401);
  }

  // Check if session is revoked
  if (session.revokedAt) {
    return c.json({ error: 'Session révoquée' }, 401);
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    return c.json({ error: 'Session expirée' }, 401);
  }

  // Check if user is active
  if (session.user.status !== 'active' || session.user.deletedAt) {
    return c.json({ error: 'Compte désactivé' }, 401);
  }

  // Update last seen
  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  // Set user and session in context
  c.set('user', session.user);
  c.set('session', session);

  await next();
};

// Types for context
declare module 'hono' {
  interface ContextVariableMap {
    user: {
      id: string;
      navigationMode: string;
      gestureSensitivity: number;
      useDreamTheme: boolean;
      themePreference: string;
      pinHash: string;
      status: string;
      createdAt: Date;
      deletedAt: Date | null;
    };
    session: {
      id: string;
      token: string;
      userId: string;
    };
  }
}
