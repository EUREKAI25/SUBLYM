import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { createSession, verifySession, revokeSession } from '../services/session.js';
import { authMiddleware } from '../middleware/auth.js';

export const authRoutes = new Hono();

// ===========================================
// SCHEMAS
// ===========================================

const accessCodeSchema = z.object({
  code: z.string().min(6).max(32),
});

const createPinSchema = z.object({
  pin: z.string().length(6).regex(/^\d{6}$/, 'PIN must be 6 digits'),
});

const verifyPinSchema = z.object({
  pin: z.string().length(6).regex(/^\d{6}$/, 'PIN must be 6 digits'),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * POST /api/auth/access-code
 * Validate an access code and create a session (but user needs to set PIN first)
 */
authRoutes.post('/access-code', zValidator('json', accessCodeSchema), async (c) => {
  const { code } = c.req.valid('json');

  // Find access code
  const accessCode = await prisma.accessCode.findUnique({
    where: { code },
  });

  if (!accessCode) {
    return c.json({ error: 'Code invalide' }, 401);
  }

  // Check status
  if (accessCode.status === 'revoked') {
    return c.json({ error: 'Ce code a été révoqué' }, 401);
  }

  if (accessCode.status === 'expired' || (accessCode.expiresAt && accessCode.expiresAt < new Date())) {
    await prisma.accessCode.update({
      where: { id: accessCode.id },
      data: { status: 'expired' },
    });
    return c.json({ error: 'Ce code a expiré' }, 401);
  }

  // Check max uses
  if (accessCode.currentUses >= accessCode.maxActivations) {
    return c.json({ error: 'Ce code a atteint le nombre maximum d\'utilisations' }, 401);
  }

  // Check if already has a user
  if (accessCode.userId) {
    // Return existing user info for PIN verification
    return c.json({
      status: 'existing_user',
      userId: accessCode.userId,
      requirePin: true,
    });
  }

  // New user - needs to create PIN
  return c.json({
    status: 'new_user',
    accessCodeId: accessCode.id,
    requirePin: true,
    source: accessCode.source,
  });
});

/**
 * POST /api/auth/create-pin
 * Create a new user with PIN (first-time activation)
 */
authRoutes.post('/create-pin', zValidator('json', z.object({
  accessCodeId: z.string().uuid(),
  pin: z.string().length(6).regex(/^\d{6}$/),
})), async (c) => {
  const { accessCodeId, pin } = c.req.valid('json');

  // Find access code
  const accessCode = await prisma.accessCode.findUnique({
    where: { id: accessCodeId },
  });

  if (!accessCode || accessCode.status !== 'valid' || accessCode.userId) {
    return c.json({ error: 'Code invalide ou déjà utilisé' }, 401);
  }

  // Hash PIN
  const pinHash = await bcrypt.hash(pin, parseInt(process.env.PIN_SALT_ROUNDS || '10'));

  // Create user
  const user = await prisma.user.create({
    data: {
      pinHash,
    },
  });

  // Update access code
  await prisma.accessCode.update({
    where: { id: accessCodeId },
    data: {
      status: 'used',
      userId: user.id,
      usedAt: new Date(),
      currentUses: { increment: 1 },
    },
  });

  // Create session
  const session = await createSession(user.id, c.req.header('user-agent'), c.req.header('x-forwarded-for'));

  // Log
  await prisma.auditLog.create({
    data: {
      action: 'USER_CREATE',
      actor: `user:${user.id}`,
      target: `user:${user.id}`,
      details: { source: accessCode.source },
    },
  });

  return c.json({
    status: 'success',
    token: session.token,
    user: {
      id: user.id,
      navigationMode: user.navigationMode,
      useDreamTheme: user.useDreamTheme,
      themePreference: user.themePreference,
    },
  });
});

/**
 * POST /api/auth/verify-pin
 * Verify PIN for existing user
 */
authRoutes.post('/verify-pin', zValidator('json', z.object({
  userId: z.string().uuid(),
  pin: z.string().length(6).regex(/^\d{6}$/),
})), async (c) => {
  const { userId, pin } = c.req.valid('json');

  // Find user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.deletedAt || user.status === 'blocked') {
    return c.json({ error: 'Utilisateur non trouvé' }, 401);
  }

  // Verify PIN
  const validPin = await bcrypt.compare(pin, user.pinHash);

  if (!validPin) {
    return c.json({ error: 'PIN incorrect' }, 401);
  }

  // Create session
  const session = await createSession(user.id, c.req.header('user-agent'), c.req.header('x-forwarded-for'));

  return c.json({
    status: 'success',
    token: session.token,
    user: {
      id: user.id,
      navigationMode: user.navigationMode,
      useDreamTheme: user.useDreamTheme,
      themePreference: user.themePreference,
    },
  });
});

/**
 * POST /api/auth/lock
 * Lock the current session (requires PIN to unlock)
 */
authRoutes.post('/lock', authMiddleware, async (c) => {
  // Session stays valid but frontend shows lock screen
  return c.json({ status: 'locked' });
});

/**
 * POST /api/auth/logout
 * Revoke the current session
 */
authRoutes.post('/logout', authMiddleware, async (c) => {
  const session = c.get('session');
  await revokeSession(session.id);
  return c.json({ status: 'logged_out' });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
authRoutes.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({
    id: user.id,
    navigationMode: user.navigationMode,
    gestureSensitivity: user.gestureSensitivity,
    useDreamTheme: user.useDreamTheme,
    themePreference: user.themePreference,
    createdAt: user.createdAt,
  });
});
