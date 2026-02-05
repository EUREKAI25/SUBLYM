// SUBLYM Backend - Smile Routes

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { prisma } from '../db';
import { authMiddleware, optionalAuthMiddleware, getAuthContext } from '../middleware/auth';
import { uploadRateLimiter } from '../middleware/rate-limiter';
import { ValidationError, ForbiddenError } from '../middleware/error-handler';

const app = new Hono();

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

// ============================================
// GET /smile/status - ACCESSIBLE SANS AUTH
// ============================================

app.get('/status', async (c) => {
  // Essayer de récupérer le user si connecté (optionnel)
  let user = null;
  const authHeader = c.req.header('Authorization');
  
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const { verify } = await import('hono/jwt');
      const payload = await verify(token, process.env.JWT_SECRET!, 'HS256');
      if (payload.type === 'access' && payload.sub) {
        user = await prisma.user.findUnique({
          where: { id: payload.sub as number },
        });
      }
    } catch {
      // Token invalide, on continue sans user
    }
  }
  
  // Si user connecté, vérifier s'il a déjà une réaction Smile
  if (user) {
    const existingReaction = await prisma.smileReaction.findUnique({
      where: { userId: user.id },
    });
    
    if (existingReaction) {
      return c.json({
        available: false,
        hasStarted: true,
        status: existingReaction.status,
        premiumGranted: existingReaction.premiumGranted,
        premiumUntil: existingReaction.premiumUntil,
      });
    }
  }
  
  // Vérifier la disponibilité globale
  const smileConfig = await prisma.smileConfig.findFirst({
    where: {
      isActive: true,
      OR: [
        { country: user?.country || 'ALL' },
        { country: 'ALL' },
      ],
    },
    orderBy: { country: 'desc' }, // Préférer la config spécifique au pays
  });
  
  if (!smileConfig) {
    return c.json({
      available: false,
      reason: 'not_configured',
    });
  }
  
  if (smileConfig.currentCount >= smileConfig.threshold) {
    return c.json({
      available: false,
      reason: 'threshold_reached',
    });
  }
  
  // Smile disponible !
  return c.json({
    available: true,
    premiumLevel: smileConfig.premiumLevel,
    premiumMonths: smileConfig.premiumMonths,
    remaining: smileConfig.threshold - smileConfig.currentCount,
  });
});

// ============================================
// Routes protégées par auth
// ============================================

// POST /smile/start
app.post('/start', authMiddleware, async (c) => {
  const { user } = getAuthContext(c);

  // Check if already started - return success (idempotent)
  const existing = await prisma.smileReaction.findUnique({
    where: { userId: user.id },
  });

  if (existing) {
    console.log(`[SMILE] User ${user.id} already started Smile (reaction ${existing.id})`);
    return c.json({
      success: true,
      already: true,
      reaction: {
        id: existing.id,
        status: existing.status,
      },
    });
  }

  // Check availability
  const smileConfig = await prisma.smileConfig.findFirst({
    where: {
      OR: [
        { country: user.country || 'ALL' },
        { country: 'ALL' },
      ],
      isActive: true,
    },
    orderBy: { country: 'desc' },
  });

  if (!smileConfig || smileConfig.currentCount >= smileConfig.threshold) {
    return c.json({
      error: 'OFFER_ENDED',
      message: 'The Smile offer has ended for your country',
    }, 410);
  }

  // Grant subscription to user
  const subscriptionEnd = new Date();
  subscriptionEnd.setMonth(subscriptionEnd.getMonth() + smileConfig.premiumMonths);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionLevel: smileConfig.premiumLevel,
      subscriptionEnd,
    },
  });

  console.log(`[SMILE] User ${user.id} granted level ${smileConfig.premiumLevel} until ${subscriptionEnd.toISOString()}`);

  // Create reaction record
  const reaction = await prisma.smileReaction.create({
    data: {
      userId: user.id,
      status: 'pending',
      premiumLevel: smileConfig.premiumLevel,
    },
  });

  // Increment smile count
  await prisma.smileConfig.update({
    where: { id: smileConfig.id },
    data: { currentCount: { increment: 1 } },
  });

  return c.json({
    success: true,
    message: 'Smile offer started. Watch your video and record your reaction!',
    reaction: {
      id: reaction.id,
      status: reaction.status,
    },
    subscription: {
      level: smileConfig.premiumLevel,
      until: subscriptionEnd,
    },
  });
});

// POST /smile/upload
app.post('/upload', authMiddleware, uploadRateLimiter, async (c) => {
  const { user } = getAuthContext(c);
  
  // Get reaction
  const reaction = await prisma.smileReaction.findUnique({
    where: { userId: user.id },
  });
  
  if (!reaction) {
    throw new ValidationError('You must start the Smile offer first');
  }
  
  if (reaction.status !== 'pending') {
    throw new ValidationError('You have already uploaded your reaction');
  }
  
  // Parse form data
  const formData = await c.req.formData();
  const file = formData.get('video') as File;
  
  if (!file) {
    throw new ValidationError('No video provided');
  }
  
  // Validate type
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    throw new ValidationError('Invalid video format. Allowed: MP4, MOV, WebM');
  }
  
  // Validate size
  if (file.size > MAX_VIDEO_SIZE) {
    throw new ValidationError('Video too large. Maximum: 100MB');
  }
  
  // Save file
  const smileDir = path.join(STORAGE_PATH, 'smile', user.id.toString());
  await fs.mkdir(smileDir, { recursive: true });
  
  const ext = file.type === 'video/quicktime' ? 'mov' : file.type.split('/')[1];
  const filename = `reaction.${ext}`;
  const filePath = path.join(smileDir, filename);
  const relativePath = `smile/${user.id}/${filename}`;
  
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);
  
  // Get smile config for premium details
  const smileConfig = await prisma.smileConfig.findFirst({
    where: { isActive: true },
    orderBy: { country: 'desc' },
  });
  
  const premiumMonths = smileConfig?.premiumMonths || 3;
  const premiumLevel = reaction.premiumLevel || smileConfig?.premiumLevel || 3;
  const premiumUntil = new Date();
  premiumUntil.setMonth(premiumUntil.getMonth() + premiumMonths);
  
  // Update reaction - AUTO APPROVE
  await prisma.smileReaction.update({
    where: { id: reaction.id },
    data: {
      videoPath: relativePath,
      videoSize: file.size,
      status: 'uploaded',
      uploadedAt: new Date(),
      premiumGranted: true,
      premiumLevel,
      premiumUntil,
      grantedAt: new Date(),
    },
  });
  
  // Update user subscription
  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionLevel: premiumLevel,
      subscriptionEnd: premiumUntil,
    },
  });
  
  // Increment smile count
  if (smileConfig) {
    await prisma.smileConfig.update({
      where: { id: smileConfig.id },
      data: { currentCount: { increment: 1 } },
    });
  }
  
  return c.json({
    success: true,
    message: `Congratulations! You now have ${premiumMonths} months of Premium!`,
    premiumLevel,
    premiumUntil,
  });
});

// DELETE /smile/cancel
app.delete('/cancel', authMiddleware, async (c) => {
  const { user } = getAuthContext(c);
  
  const reaction = await prisma.smileReaction.findUnique({
    where: { userId: user.id },
  });
  
  if (!reaction) {
    throw new ValidationError('No Smile offer found');
  }
  
  if (reaction.premiumGranted) {
    throw new ForbiddenError('Cannot cancel after premium has been granted');
  }
  
  // Delete reaction
  await prisma.smileReaction.delete({
    where: { id: reaction.id },
  });
  
  // Delete video if exists
  if (reaction.videoPath) {
    const filePath = path.join(STORAGE_PATH, reaction.videoPath);
    try {
      await fs.unlink(filePath);
    } catch {}
  }
  
  return c.json({
    success: true,
    message: 'Smile offer cancelled',
  });
});

// POST /smile/comment
app.post('/comment', authMiddleware, async (c) => {
  const { user } = getAuthContext(c);

  const reaction = await prisma.smileReaction.findUnique({
    where: { userId: user.id },
  });

  if (!reaction) {
    throw new ValidationError('No Smile reaction found');
  }

  const body = await c.req.json();
  const comment = body.comment?.trim();

  if (!comment || comment.length < 5) {
    throw new ValidationError('Comment must be at least 5 characters');
  }

  if (comment.length > 1000) {
    throw new ValidationError('Comment must be less than 1000 characters');
  }

  await prisma.smileReaction.update({
    where: { id: reaction.id },
    data: {
      comment,
      commentedAt: new Date(),
    },
  });

  return c.json({
    success: true,
    message: 'Comment saved',
  });
});

export { app as smileRoutes };
