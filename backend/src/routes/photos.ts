// SUBLYM Backend - Photos Routes

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { prisma } from '../db';
import { authMiddleware, getAuthContext } from '../middleware/auth';
import { uploadRateLimiter } from '../middleware/rate-limiter';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/error-handler';
import { verifyPhotosWithRekognition } from '../services/rekognition';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// ============================================
// CONSTANTS
// ============================================

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const MAX_PHOTO_SIZE = 8 * 1024 * 1024; // 8MB
const MAX_DIMENSION = 1024;
const QUALITY = 85;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 5;

// ============================================
// HELPERS
// ============================================

async function processImage(buffer: Buffer): Promise<Buffer> {
  let image = sharp(buffer);
  const metadata = await image.metadata();
  
  // Resize if too large (maintain aspect ratio)
  if (metadata.width && metadata.width > MAX_DIMENSION) {
    image = image.resize(MAX_DIMENSION, null, { withoutEnlargement: true });
  } else if (metadata.height && metadata.height > MAX_DIMENSION) {
    image = image.resize(null, MAX_DIMENSION, { withoutEnlargement: true });
  }
  
  // Convert to JPEG with quality
  return image.jpeg({ quality: QUALITY }).toBuffer();
}

async function ensureUserPhotoDir(userId: number): Promise<string> {
  const dir = path.join(STORAGE_PATH, 'users', userId.toString(), 'photos');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// ============================================
// POST /photos/upload
// ============================================

app.post('/upload', uploadRateLimiter, async (c) => {
  const { user } = getAuthContext(c);
  
  // Parse multipart form
  const formData = await c.req.formData();
  const files = formData.getAll('photos') as File[];
  const consent = formData.get('consent') === 'true';
  
  if (!consent) {
    throw new ValidationError('You must accept the terms to upload photos');
  }
  
  // Get current photo count
  const currentPhotos = await prisma.photo.count({
    where: { userId: user.id },
  });
  
  // Validate file count
  const totalPhotos = currentPhotos + files.length;
  
  if (files.length === 0) {
    throw new ValidationError('No photos provided');
  }
  
  if (totalPhotos > MAX_PHOTOS) {
    throw new ValidationError(
      `Maximum ${MAX_PHOTOS} photos allowed. You currently have ${currentPhotos}.`
    );
  }
  
  // Process each file
  const photoDir = await ensureUserPhotoDir(user.id);
  const uploadedPhotos = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError(
        `Invalid file type: ${file.type}. Allowed: JPG, PNG, WebP, HEIC`
      );
    }
    
    // Validate size
    if (file.size > MAX_PHOTO_SIZE) {
      throw new ValidationError(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 8MB`
      );
    }
    
    // Read and process
    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await processImage(buffer);
    
    // Generate filename
    const filename = `${uuidv4()}.jpg`;
    const filePath = path.join(photoDir, filename);
    const relativePath = `users/${user.id}/photos/${filename}`;
    
    // Save file
    await fs.writeFile(filePath, processed);
    
    // Auto-verify if Rekognition is not configured
    const autoVerify = !process.env.AWS_ACCESS_KEY_ID;

    // Create database record
    const photo = await prisma.photo.create({
      data: {
        userId: user.id,
        filename,
        path: relativePath,
        originalName: file.name,
        mimeType: 'image/jpeg',
        size: processed.length,
        order: currentPhotos + i,
        verified: autoVerify,
      },
    });
    
    uploadedPhotos.push({
      id: photo.id,
      path: relativePath,
      order: photo.order,
      verified: photo.verified,
    });
  }
  
  return c.json({
    success: true,
    photos: uploadedPhotos,
    total: currentPhotos + files.length,
    message: `${files.length} photo(s) uploaded. Please verify your photos.`,
  }, 201);
});

// ============================================
// GET /photos
// ============================================

app.get('/', async (c) => {
  const { user } = getAuthContext(c);
  
  const photos = await prisma.photo.findMany({
    where: { userId: user.id },
    orderBy: { order: 'asc' },
  });
  
  return c.json({
    photos: photos.map((p) => ({
      id: p.id,
      path: p.path,
      order: p.order,
      verified: p.verified,
      qualityScore: p.qualityScore,
      createdAt: p.createdAt,
    })),
    total: photos.length,
    allVerified: photos.length >= MIN_PHOTOS && photos.every((p) => p.verified),
  });
});

// ============================================
// DELETE /photos/:id
// ============================================

app.delete('/:id', async (c) => {
  const { user } = getAuthContext(c);
  const photoId = parseInt(c.req.param('id'));
  
  // Get photo
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
  });
  
  if (!photo) {
    throw new NotFoundError('Photo');
  }
  
  if (photo.userId !== user.id) {
    throw new ForbiddenError('You cannot delete this photo');
  }
  
  // Check if deletion would leave less than MIN_PHOTOS
  const photoCount = await prisma.photo.count({
    where: { userId: user.id },
  });
  
  if (photoCount <= MIN_PHOTOS) {
    throw new ValidationError(
      `You must have at least ${MIN_PHOTOS} photos. Upload a replacement before deleting.`
    );
  }
  
  // Delete file
  const filePath = path.join(STORAGE_PATH, photo.path);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    console.error('Failed to delete photo file:', err);
  }
  
  // Delete database record
  await prisma.photo.delete({
    where: { id: photoId },
  });
  
  // Reorder remaining photos
  const remainingPhotos = await prisma.photo.findMany({
    where: { userId: user.id },
    orderBy: { order: 'asc' },
  });
  
  for (let i = 0; i < remainingPhotos.length; i++) {
    if (remainingPhotos[i].order !== i) {
      await prisma.photo.update({
        where: { id: remainingPhotos[i].id },
        data: { order: i },
      });
    }
  }
  
  return c.json({
    success: true,
    message: 'Photo deleted',
    remaining: photoCount - 1,
  });
});

// ============================================
// PUT /photos/:id (replace single photo)
// ============================================

app.put('/:id', uploadRateLimiter, async (c) => {
  const { user } = getAuthContext(c);
  const photoId = parseInt(c.req.param('id'));
  
  // Get existing photo
  const existingPhoto = await prisma.photo.findUnique({
    where: { id: photoId },
  });
  
  if (!existingPhoto) {
    throw new NotFoundError('Photo');
  }
  
  if (existingPhoto.userId !== user.id) {
    throw new ForbiddenError('You cannot replace this photo');
  }
  
  // Parse form data
  const formData = await c.req.formData();
  const file = formData.get('photo') as File;
  
  if (!file) {
    throw new ValidationError('No photo provided');
  }
  
  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ValidationError(
      `Invalid file type: ${file.type}. Allowed: JPG, PNG, WebP, HEIC`
    );
  }
  
  // Validate size
  if (file.size > MAX_PHOTO_SIZE) {
    throw new ValidationError(
      `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 8MB`
    );
  }
  
  // Process image
  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await processImage(buffer);
  
  // Delete old file
  const oldFilePath = path.join(STORAGE_PATH, existingPhoto.path);
  try {
    await fs.unlink(oldFilePath);
  } catch (err) {
    console.error('Failed to delete old photo file:', err);
  }
  
  // Save new file
  const photoDir = await ensureUserPhotoDir(user.id);
  const filename = `${uuidv4()}.jpg`;
  const filePath = path.join(photoDir, filename);
  const relativePath = `users/${user.id}/photos/${filename}`;
  
  await fs.writeFile(filePath, processed);
  
  // Update database
  const updatedPhoto = await prisma.photo.update({
    where: { id: photoId },
    data: {
      filename,
      path: relativePath,
      originalName: file.name,
      mimeType: 'image/jpeg',
      size: processed.length,
      verified: false, // Reset verification
      qualityScore: null,
    },
  });
  
  return c.json({
    success: true,
    photo: {
      id: updatedPhoto.id,
      path: updatedPhoto.path,
      order: updatedPhoto.order,
      verified: updatedPhoto.verified,
    },
    message: 'Photo replaced. Please verify your photos again.',
  });
});

// ============================================
// POST /photos/verify
// ============================================

app.post('/verify', async (c) => {
  const { user } = getAuthContext(c);
  
  // Get all user photos
  const photos = await prisma.photo.findMany({
    where: { userId: user.id },
    orderBy: { order: 'asc' },
  });
  
  if (photos.length < MIN_PHOTOS) {
    throw new ValidationError(
      `You need at least ${MIN_PHOTOS} photos. You have ${photos.length}.`
    );
  }
  
  // Get full paths
  const photoPaths = photos.map((p) => path.join(STORAGE_PATH, p.path));
  
  // Verify with Rekognition
  const result = await verifyPhotosWithRekognition(photoPaths);
  
  if (result.valid) {
    // Mark all as verified
    await prisma.photo.updateMany({
      where: { userId: user.id },
      data: { verified: true },
    });
    
    // Update quality scores if available
    if (result.qualityScores) {
      for (let i = 0; i < photos.length; i++) {
        if (result.qualityScores[i] !== undefined) {
          await prisma.photo.update({
            where: { id: photos[i].id },
            data: { qualityScore: result.qualityScores[i] },
          });
        }
      }
    }
    
    return c.json({
      success: true,
      verified: true,
      message: 'All photos verified successfully',
    });
  } else {
    // Mark invalid photos
    for (const index of result.invalidPhotos) {
      await prisma.photo.update({
        where: { id: photos[index].id },
        data: { verified: false, qualityScore: null },
      });
    }
    
    return c.json({
      success: false,
      verified: false,
      error: 'FACE_MISMATCH',
      message: result.message,
      invalidPhotos: result.invalidPhotos.map((i) => ({
        id: photos[i].id,
        order: photos[i].order,
      })),
    }, 400);
  }
});

// ============================================
// POST /photos/reorder
// ============================================

const reorderSchema = z.object({
  order: z.array(z.number()).min(MIN_PHOTOS).max(MAX_PHOTOS),
});

app.post('/reorder', zValidator('json', reorderSchema), async (c) => {
  const { user } = getAuthContext(c);
  const { order } = c.req.valid('json');
  
  // Verify all IDs belong to user
  const photos = await prisma.photo.findMany({
    where: { userId: user.id },
  });
  
  const photoIds = photos.map((p) => p.id);
  
  for (const id of order) {
    if (!photoIds.includes(id)) {
      throw new ValidationError(`Photo ${id} not found`);
    }
  }
  
  if (order.length !== photos.length) {
    throw new ValidationError('Order must include all photos');
  }
  
  // Update order
  for (let i = 0; i < order.length; i++) {
    await prisma.photo.update({
      where: { id: order[i] },
      data: { order: i },
    });
  }
  
  return c.json({
    success: true,
    message: 'Photos reordered',
  });
});

export { app as photosRoutes };
