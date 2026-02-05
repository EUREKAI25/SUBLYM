import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

export const userRoutes = new Hono();

userRoutes.use('*', authMiddleware);

// ===========================================
// SCHEMAS
// ===========================================

const updateSettingsSchema = z.object({
  navigationMode: z.enum(['scroll', 'swipe']).optional(),
  gestureSensitivity: z.number().min(0).max(1).optional(),
  useDreamTheme: z.boolean().optional(),
  themePreference: z.enum(['system', 'light', 'dark']).optional(),
});

const changePinSchema = z.object({
  currentPin: z.string().length(6).regex(/^\d{6}$/),
  newPin: z.string().length(6).regex(/^\d{6}$/),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/users/settings
 * Get current user settings
 */
userRoutes.get('/settings', async (c) => {
  const user = c.get('user');

  return c.json({
    navigationMode: user.navigationMode,
    gestureSensitivity: user.gestureSensitivity,
    useDreamTheme: user.useDreamTheme,
    themePreference: user.themePreference,
  });
});

/**
 * PATCH /api/users/settings
 * Update user settings
 */
userRoutes.patch('/settings', zValidator('json', updateSettingsSchema), async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      action: 'USER_SETTINGS_UPDATE',
      actor: `user:${user.id}`,
      target: `user:${user.id}`,
      details: data,
    },
  });

  return c.json({
    navigationMode: updated.navigationMode,
    gestureSensitivity: updated.gestureSensitivity,
    useDreamTheme: updated.useDreamTheme,
    themePreference: updated.themePreference,
  });
});

/**
 * POST /api/users/change-pin
 * Change the user's PIN
 */
userRoutes.post('/change-pin', zValidator('json', changePinSchema), async (c) => {
  const user = c.get('user');
  const { currentPin, newPin } = c.req.valid('json');

  // Verify current PIN
  const validPin = await bcrypt.compare(currentPin, user.pinHash);
  if (!validPin) {
    return c.json({ error: 'PIN actuel incorrect' }, 401);
  }

  // Hash new PIN
  const newPinHash = await bcrypt.hash(newPin, parseInt(process.env.PIN_SALT_ROUNDS || '10'));

  await prisma.user.update({
    where: { id: user.id },
    data: { pinHash: newPinHash },
  });

  await prisma.auditLog.create({
    data: {
      action: 'USER_PIN_CHANGE',
      actor: `user:${user.id}`,
      target: `user:${user.id}`,
    },
  });

  return c.json({ status: 'pin_changed' });
});

/**
 * GET /api/users/stats
 * Get user statistics
 */
userRoutes.get('/stats', async (c) => {
  const user = c.get('user');

  const [dreamsCount, photosCount, generatedImagesCount, realizedCount, markersCount] = await Promise.all([
    prisma.dream.count({ where: { userId: user.id } }),
    prisma.imageAsset.count({ where: { userId: user.id, kind: 'user_photo', deletedAt: null } }),
    prisma.imageAsset.count({ where: { userId: user.id, kind: 'dream_image', deletedAt: null } }),
    prisma.dream.count({ where: { userId: user.id, status: 'realized' } }),
    prisma.marker.count({ where: { userId: user.id } }),
  ]);

  return c.json({
    dreams: {
      total: dreamsCount,
      realized: realizedCount,
    },
    photos: {
      uploaded: photosCount,
      maxAllowed: 6,
    },
    generated: {
      images: generatedImagesCount,
    },
    markers: markersCount,
    memberSince: user.createdAt,
  });
});

/**
 * DELETE /api/users/account
 * Delete user account (soft delete)
 */
userRoutes.delete('/account', zValidator('json', z.object({
  pin: z.string().length(6).regex(/^\d{6}$/),
  confirm: z.literal(true),
})), async (c) => {
  const user = c.get('user');
  const { pin } = c.req.valid('json');

  // Verify PIN
  const validPin = await bcrypt.compare(pin, user.pinHash);
  if (!validPin) {
    return c.json({ error: 'PIN incorrect' }, 401);
  }

  // Soft delete user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      deletedAt: new Date(),
      status: 'blocked',
    },
  });

  // Revoke all sessions
  await prisma.session.updateMany({
    where: { userId: user.id },
    data: { revokedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      action: 'USER_DELETE',
      actor: `user:${user.id}`,
      target: `user:${user.id}`,
    },
  });

  return c.json({ status: 'account_deleted' });
});

/**
 * GET /api/users/export
 * Export user data (GDPR)
 */
userRoutes.get('/export', async (c) => {
  const user = c.get('user');

  const [dreams, assets, markers] = await Promise.all([
    prisma.dream.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        description: true,
        rejectText: true,
        status: true,
        createdAt: true,
        realizedAt: true,
      },
    }),
    prisma.imageAsset.findMany({
      where: { userId: user.id, deletedAt: null },
      select: {
        id: true,
        kind: true,
        source: true,
        createdAt: true,
      },
    }),
    prisma.marker.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        type: true,
        note: true,
        createdAt: true,
      },
    }),
  ]);

  return c.json({
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      createdAt: user.createdAt,
      settings: {
        navigationMode: user.navigationMode,
        gestureSensitivity: user.gestureSensitivity,
        useDreamTheme: user.useDreamTheme,
        themePreference: user.themePreference,
      },
    },
    dreams,
    assets,
    markers,
  });
});
