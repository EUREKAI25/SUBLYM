import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { triggerGeneration } from '../services/generation.js';

export const dreamRoutes = new Hono();

// Apply auth middleware to all routes
dreamRoutes.use('*', authMiddleware);

// ===========================================
// SCHEMAS
// ===========================================

const createDreamSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().min(10).max(2000),
  rejectText: z.string().max(1000).optional(),
});

const updateDreamSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().min(10).max(2000).optional(),
  rejectText: z.string().max(1000).optional(),
  status: z.enum(['active', 'inactive', 'realized']).optional(),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/dreams
 * List all dreams for current user
 */
dreamRoutes.get('/', async (c) => {
  const user = c.get('user');

  const dreams = await prisma.dream.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      imageAssets: {
        where: { deletedAt: null, isEnabled: true, kind: 'dream_image' },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          imageAssets: { where: { deletedAt: null, kind: 'dream_image' } },
          markers: true,
        },
      },
    },
  });

  return c.json({
    dreams: dreams.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description.substring(0, 100) + (d.description.length > 100 ? '...' : ''),
      status: d.status,
      isActive: d.isActive,
      thumbnailUrl: d.imageAssets[0]?.storageUrl || null,
      imagesCount: d._count.imageAssets,
      markersCount: d._count.markers,
      createdAt: d.createdAt,
      realizedAt: d.realizedAt,
    })),
  });
});

/**
 * POST /api/dreams
 * Create a new dream
 */
dreamRoutes.post('/', zValidator('json', createDreamSchema), async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');

  // Deactivate other dreams if this one should be active (V1: single active)
  await prisma.dream.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false },
  });

  const dream = await prisma.dream.create({
    data: {
      userId: user.id,
      title: data.title,
      description: data.description,
      rejectText: data.rejectText,
      isActive: true,
    },
  });

  // Create default sequence
  await prisma.dreamSequence.create({
    data: {
      dreamId: dream.id,
      loop: true,
    },
  });

  // Log
  await prisma.auditLog.create({
    data: {
      action: 'DREAM_CREATE',
      actor: `user:${user.id}`,
      target: `dream:${dream.id}`,
    },
  });

  return c.json({ dream }, 201);
});

/**
 * GET /api/dreams/:id
 * Get a single dream with all images
 */
dreamRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const dreamId = c.req.param('id');

  const dream = await prisma.dream.findFirst({
    where: { id: dreamId, userId: user.id },
    include: {
      imageAssets: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
      sequences: {
        include: {
          items: {
            include: { asset: true },
            orderBy: { order: 'asc' },
          },
        },
      },
      generationJobs: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!dream) {
    return c.json({ error: 'Rêve non trouvé' }, 404);
  }

  return c.json({ dream });
});

/**
 * PATCH /api/dreams/:id
 * Update a dream
 */
dreamRoutes.patch('/:id', zValidator('json', updateDreamSchema), async (c) => {
  const user = c.get('user');
  const dreamId = c.req.param('id');
  const data = c.req.valid('json');

  const dream = await prisma.dream.findFirst({
    where: { id: dreamId, userId: user.id },
  });

  if (!dream) {
    return c.json({ error: 'Rêve non trouvé' }, 404);
  }

  // If setting to realized, record the date
  const updateData: any = { ...data };
  if (data.status === 'realized' && dream.status !== 'realized') {
    updateData.realizedAt = new Date();
  }

  // If activating this dream, deactivate others
  if (data.status === 'active') {
    await prisma.dream.updateMany({
      where: { userId: user.id, id: { not: dreamId }, isActive: true },
      data: { isActive: false },
    });
    updateData.isActive = true;
  } else if (data.status === 'inactive' || data.status === 'realized') {
    updateData.isActive = false;
  }

  const updated = await prisma.dream.update({
    where: { id: dreamId },
    data: updateData,
  });

  // Log status change
  if (data.status) {
    await prisma.auditLog.create({
      data: {
        action: 'DREAM_STATUS_CHANGE',
        actor: `user:${user.id}`,
        target: `dream:${dreamId}`,
        details: { from: dream.status, to: data.status },
      },
    });
  }

  return c.json({ dream: updated });
});

/**
 * DELETE /api/dreams/:id
 * Delete a dream (soft delete)
 */
dreamRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const dreamId = c.req.param('id');

  const dream = await prisma.dream.findFirst({
    where: { id: dreamId, userId: user.id },
  });

  if (!dream) {
    return c.json({ error: 'Rêve non trouvé' }, 404);
  }

  // Soft delete all related assets
  await prisma.imageAsset.updateMany({
    where: { dreamId },
    data: { deletedAt: new Date() },
  });

  // Delete dream (cascades to sequences, markers, jobs)
  await prisma.dream.delete({
    where: { id: dreamId },
  });

  await prisma.auditLog.create({
    data: {
      action: 'DREAM_DELETE',
      actor: `user:${user.id}`,
      target: `dream:${dreamId}`,
    },
  });

  return c.json({ status: 'deleted' });
});

/**
 * POST /api/dreams/:id/generate
 * Trigger image generation for a dream
 */
dreamRoutes.post('/:id/generate', async (c) => {
  const user = c.get('user');
  const dreamId = c.req.param('id');

  const dream = await prisma.dream.findFirst({
    where: { id: dreamId, userId: user.id },
    include: {
      imageAssets: {
        where: { kind: 'user_photo', deletedAt: null },
      },
    },
  });

  if (!dream) {
    return c.json({ error: 'Rêve non trouvé' }, 404);
  }

  if (dream.imageAssets.length === 0) {
    return c.json({ error: 'Ajoutez au moins une photo avant de générer' }, 400);
  }

  // Create generation job
  const job = await prisma.generationJob.create({
    data: {
      dreamId: dream.id,
    },
  });

  // Trigger async generation
  triggerGeneration(job.id);

  return c.json({
    status: 'queued',
    jobId: job.id,
    traceId: job.traceId,
  });
});

/**
 * GET /api/dreams/:id/viewer
 * Get dream data optimized for the viewer (scroll/swipe mode)
 */
dreamRoutes.get('/:id/viewer', async (c) => {
  const user = c.get('user');
  const dreamId = c.req.param('id');

  const dream = await prisma.dream.findFirst({
    where: { id: dreamId, userId: user.id },
    include: {
      imageAssets: {
        where: {
          deletedAt: null,
          isEnabled: true,
          kind: 'dream_image',
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!dream) {
    return c.json({ error: 'Rêve non trouvé' }, 404);
  }

  return c.json({
    id: dream.id,
    title: dream.title,
    palette: dream.palette,
    backgroundAssetId: dream.backgroundAssetId,
    navigationMode: user.navigationMode,
    images: dream.imageAssets.map(a => ({
      id: a.id,
      url: a.storageUrl,
      width: a.width,
      height: a.height,
      isFavorite: a.isFavorite,
    })),
    loop: true,
  });
});
