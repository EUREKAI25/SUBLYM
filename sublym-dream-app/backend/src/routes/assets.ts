import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadToS3, deleteFromS3, getSignedUrl } from '../services/storage.js';

export const assetRoutes = new Hono();

assetRoutes.use('*', authMiddleware);

// ===========================================
// CONSTANTS
// ===========================================

const MAX_USER_PHOTOS = 6;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ===========================================
// SCHEMAS
// ===========================================

const uploadSchema = z.object({
  dreamId: z.string().uuid().optional(),
  kind: z.enum(['user_photo', 'dream_image', 'wallpaper']).default('user_photo'),
  source: z.enum(['upload', 'webcam']).default('upload'),
});

const updateAssetSchema = z.object({
  isEnabled: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/assets
 * List all assets for current user
 */
assetRoutes.get('/', async (c) => {
  const user = c.get('user');
  const kind = c.req.query('kind');
  const dreamId = c.req.query('dreamId');

  const where: any = {
    userId: user.id,
    deletedAt: null,
  };

  if (kind) where.kind = kind;
  if (dreamId) where.dreamId = dreamId;

  const assets = await prisma.imageAsset.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  // Generate signed URLs for each asset
  const assetsWithUrls = await Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      url: await getSignedUrl(asset.storageKey),
    }))
  );

  return c.json({ assets: assetsWithUrls });
});

/**
 * POST /api/assets/upload
 * Upload a new image
 */
assetRoutes.post('/upload', async (c) => {
  const user = c.get('user');

  // Parse multipart form
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const dreamId = formData.get('dreamId') as string | null;
  const kind = (formData.get('kind') as string) || 'user_photo';
  const source = (formData.get('source') as string) || 'upload';

  if (!file) {
    return c.json({ error: 'Aucun fichier fourni' }, 400);
  }

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return c.json({ error: 'Type de fichier non supporté. Utilisez JPG, PNG ou WebP.' }, 400);
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'Fichier trop volumineux. Maximum 10MB.' }, 400);
  }

  // Check user photo limit
  if (kind === 'user_photo') {
    const currentCount = await prisma.imageAsset.count({
      where: {
        userId: user.id,
        kind: 'user_photo',
        deletedAt: null,
      },
    });

    if (currentCount >= MAX_USER_PHOTOS) {
      return c.json({
        error: 'Limite atteinte. Supprimez d\'abord une photo pour pouvoir en charger une nouvelle.',
        currentCount,
        maxCount: MAX_USER_PHOTOS,
      }, 400);
    }
  }

  // Upload to S3
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadToS3(buffer, file.type, user.id, kind);

  // Create asset record
  const asset = await prisma.imageAsset.create({
    data: {
      userId: user.id,
      dreamId: dreamId || undefined,
      kind,
      source,
      storageKey: result.key,
      format: file.type.split('/')[1],
      bytes: file.size,
      width: result.width,
      height: result.height,
      hash: result.hash,
    },
  });

  // Log
  await prisma.auditLog.create({
    data: {
      action: 'ASSET_UPLOAD',
      actor: `user:${user.id}`,
      target: `asset:${asset.id}`,
      details: { kind, dreamId },
    },
  });

  return c.json({
    asset: {
      ...asset,
      url: await getSignedUrl(asset.storageKey),
    },
  }, 201);
});

/**
 * GET /api/assets/:id
 * Get a single asset
 */
assetRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const assetId = c.req.param('id');

  const asset = await prisma.imageAsset.findFirst({
    where: { id: assetId, userId: user.id, deletedAt: null },
  });

  if (!asset) {
    return c.json({ error: 'Image non trouvée' }, 404);
  }

  return c.json({
    asset: {
      ...asset,
      url: await getSignedUrl(asset.storageKey),
    },
  });
});

/**
 * PATCH /api/assets/:id
 * Update an asset (enable/disable, favorite)
 */
assetRoutes.patch('/:id', zValidator('json', updateAssetSchema), async (c) => {
  const user = c.get('user');
  const assetId = c.req.param('id');
  const data = c.req.valid('json');

  const asset = await prisma.imageAsset.findFirst({
    where: { id: assetId, userId: user.id, deletedAt: null },
  });

  if (!asset) {
    return c.json({ error: 'Image non trouvée' }, 404);
  }

  const updated = await prisma.imageAsset.update({
    where: { id: assetId },
    data,
  });

  return c.json({ asset: updated });
});

/**
 * DELETE /api/assets/:id
 * Delete an asset (soft delete)
 */
assetRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const assetId = c.req.param('id');

  const asset = await prisma.imageAsset.findFirst({
    where: { id: assetId, userId: user.id, deletedAt: null },
  });

  if (!asset) {
    return c.json({ error: 'Image non trouvée' }, 404);
  }

  // Soft delete (keep in S3 for now, cleanup job later)
  await prisma.imageAsset.update({
    where: { id: assetId },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      action: 'ASSET_DELETE',
      actor: `user:${user.id}`,
      target: `asset:${assetId}`,
    },
  });

  return c.json({ status: 'deleted' });
});

/**
 * POST /api/assets/:id/set-background
 * Set an image as the dream background
 */
assetRoutes.post('/:id/set-background', async (c) => {
  const user = c.get('user');
  const assetId = c.req.param('id');

  const asset = await prisma.imageAsset.findFirst({
    where: { id: assetId, userId: user.id, deletedAt: null },
    include: { dream: true },
  });

  if (!asset || !asset.dreamId) {
    return c.json({ error: 'Image non trouvée ou non associée à un rêve' }, 404);
  }

  await prisma.dream.update({
    where: { id: asset.dreamId },
    data: { backgroundAssetId: assetId },
  });

  return c.json({ status: 'background_set' });
});

/**
 * GET /api/assets/:id/wallpaper
 * Generate and download a wallpaper version
 */
assetRoutes.get('/:id/wallpaper', async (c) => {
  const user = c.get('user');
  const assetId = c.req.param('id');

  const asset = await prisma.imageAsset.findFirst({
    where: { id: assetId, userId: user.id, deletedAt: null },
  });

  if (!asset) {
    return c.json({ error: 'Image non trouvée' }, 404);
  }

  // Generate wallpaper URL (could be transformed version)
  const url = await getSignedUrl(asset.storageKey);

  return c.json({
    url,
    instructions: {
      ios: 'Maintenez appuyé sur l\'image > Ajouter aux photos > Réglages > Fond d\'écran',
      android: 'Maintenez appuyé sur l\'image > Définir comme fond d\'écran',
    },
  });
});
