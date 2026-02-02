// SUBLYM Backend - Dreams Routes

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';
import { authMiddleware, getAuthContext, requireSubscription } from '../middleware/auth';
import { generateRateLimiter } from '../middleware/rate-limiter';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/error-handler';
import { startGeneration } from '../services/generation';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// ============================================
// SCHEMAS
// ============================================

const createDreamSchema = z.object({
  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(300, 'Description must be at most 300 characters'),
  reject: z.array(z.string()).optional(),
});

const updateDreamSchema = z.object({
  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(300, 'Description must be at most 300 characters')
    .optional(),
  reject: z.array(z.string()).optional(),
});

const generateSchema = z.object({
  subliminalText: z.string().max(100).optional(),
});

// ============================================
// POST /dreams
// ============================================

app.post('/', zValidator('json', createDreamSchema), async (c) => {
  const { user } = getAuthContext(c);
  const data = c.req.valid('json');
  
  const dream = await prisma.dream.create({
    data: {
      userId: user.id,
      description: data.description,
      reject: data.reject || [],
      status: 'draft',
    },
  });
  
  return c.json({
    success: true,
    dream: {
      id: dream.id,
      description: dream.description,
      reject: dream.reject,
      status: dream.status,
      createdAt: dream.createdAt,
    },
  }, 201);
});

// ============================================
// GET /dreams
// ============================================

app.get('/', async (c) => {
  const { user } = getAuthContext(c);
  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '10');
  const status = c.req.query('status');
  
  const where: any = { userId: user.id };
  if (status) {
    where.status = status;
  }
  
  const [dreams, total] = await Promise.all([
    prisma.dream.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            traceId: true,
            status: true,
            videoPath: true,
            teaserPath: true,
            duration: true,
            completedAt: true,
          },
        },
      },
    }),
    prisma.dream.count({ where }),
  ]);
  
  c.header('X-Total-Count', total.toString());
  c.header('X-Page', page.toString());
  c.header('X-Per-Page', perPage.toString());
  
  return c.json({
    dreams: dreams.map((d) => ({
      id: d.id,
      description: d.description,
      reject: d.reject,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      latestRun: d.runs[0] || null,
    })),
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  });
});

// ============================================
// GET /dreams/:id
// ============================================

app.get('/:id', async (c) => {
  const { user } = getAuthContext(c);
  const dreamId = parseInt(c.req.param('id'));
  
  const dream = await prisma.dream.findUnique({
    where: { id: dreamId },
    include: {
      runs: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          traceId: true,
          status: true,
          progress: true,
          currentStep: true,
          stepMessage: true,
          scenarioName: true,
          scenesCount: true,
          duration: true,
          videoPath: true,
          teaserPath: true,
          isPhotosOnly: true,
          keyframesZipPath: true,
          costEur: true,
          error: true,
          canRetry: true,
          createdAt: true,
          completedAt: true,
        },
      },
    },
  });
  
  if (!dream) {
    throw new NotFoundError('Dream');
  }
  
  if (dream.userId !== user.id) {
    throw new ForbiddenError('You cannot access this dream');
  }
  
  return c.json({
    dream: {
      id: dream.id,
      description: dream.description,
      reject: dream.reject,
      status: dream.status,
      createdAt: dream.createdAt,
      updatedAt: dream.updatedAt,
      runs: dream.runs,
    },
  });
});

// ============================================
// PUT /dreams/:id
// ============================================

app.put('/:id', zValidator('json', updateDreamSchema), async (c) => {
  const { user } = getAuthContext(c);
  const dreamId = parseInt(c.req.param('id'));
  const data = c.req.valid('json');
  
  const dream = await prisma.dream.findUnique({
    where: { id: dreamId },
  });
  
  if (!dream) {
    throw new NotFoundError('Dream');
  }
  
  if (dream.userId !== user.id) {
    throw new ForbiddenError('You cannot edit this dream');
  }
  
  if (dream.status === 'processing') {
    throw new ValidationError('Cannot edit a dream while generating');
  }
  
  const updatedDream = await prisma.dream.update({
    where: { id: dreamId },
    data: {
      ...(data.description && { description: data.description }),
      ...(data.reject !== undefined && { reject: data.reject }),
    },
  });
  
  return c.json({
    success: true,
    dream: {
      id: updatedDream.id,
      description: updatedDream.description,
      reject: updatedDream.reject,
      status: updatedDream.status,
      updatedAt: updatedDream.updatedAt,
    },
  });
});

// ============================================
// DELETE /dreams/:id
// ============================================

app.delete('/:id', async (c) => {
  const { user } = getAuthContext(c);
  const dreamId = parseInt(c.req.param('id'));
  
  const dream = await prisma.dream.findUnique({
    where: { id: dreamId },
  });
  
  if (!dream) {
    throw new NotFoundError('Dream');
  }
  
  if (dream.userId !== user.id) {
    throw new ForbiddenError('You cannot delete this dream');
  }
  
  if (dream.status === 'processing') {
    throw new ValidationError('Cannot delete a dream while generating');
  }
  
  // Delete dream (cascade will delete runs)
  await prisma.dream.delete({
    where: { id: dreamId },
  });
  
  // TODO: Clean up associated files in storage
  
  return c.json({
    success: true,
    message: 'Dream deleted',
  });
});

// ============================================
// POST /dreams/:id/generate
// ============================================

app.post('/:id/generate', generateRateLimiter, zValidator('json', generateSchema), async (c) => {
  const { user } = getAuthContext(c);
  const dreamId = parseInt(c.req.param('id'));
  const data = c.req.valid('json');
  
  // Get dream
  const dream = await prisma.dream.findUnique({
    where: { id: dreamId },
  });
  
  if (!dream) {
    throw new NotFoundError('Dream');
  }
  
  if (dream.userId !== user.id) {
    throw new ForbiddenError('You cannot generate this dream');
  }
  
  if (dream.status === 'processing') {
    throw new ValidationError('A generation is already in progress');
  }
  
  // Get user with fresh data
  const freshUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      photos: { where: { verified: true } },
    },
  });
  
  if (!freshUser) {
    throw new NotFoundError('User');
  }
  
  // Check photos are verified
  if (freshUser.photos.length < 3) {
    throw new ValidationError('You need at least 3 verified photos to generate');
  }
  
  // Get pricing level
  const pricingLevel = await prisma.pricingLevel.findUnique({
    where: { level: freshUser.subscriptionLevel },
  });
  
  // Check generation limits
  const canGenerate = await checkGenerationLimits(freshUser, pricingLevel);
  if (!canGenerate.allowed) {
    throw new ValidationError(canGenerate.reason);
  }
  
  // Check subliminal permission
  if (data.subliminalText && !pricingLevel?.subliminalEnabled) {
    throw new ForbiddenError('Subliminal text requires Premium subscription');
  }
  
  // Determine if photos only
  const isPhotosOnly = !pricingLevel?.videoEnabled;
  
  // Create run and start generation
  const run = await prisma.run.create({
    data: {
      dreamId: dream.id,
      status: 'pending',
      isPhotosOnly,
      subliminalText: data.subliminalText,
    },
  });
  
  // Update dream status
  await prisma.dream.update({
    where: { id: dreamId },
    data: { status: 'processing' },
  });
  
  // Decrement generation count
  await decrementGenerations(freshUser);
  
  // Start generation in background
  startGeneration(dream.id, user.id, run.traceId, {
    description: dream.description,
    reject: dream.reject,
    photoPaths: freshUser.photos.map((p) => p.path),
    subliminalText: data.subliminalText,
    isPhotosOnly,
    scenesCount: pricingLevel?.scenesCount || 5,
    keyframesCount: pricingLevel?.keyframesCount || 5,
    characterName: freshUser.firstName || 'User',
    characterGender: freshUser.gender || 'neutral',
  });
  
  return c.json({
    success: true,
    run: {
      id: run.id,
      traceId: run.traceId,
      status: run.status,
      isPhotosOnly,
    },
    message: `Generation started. Estimated time: ${isPhotosOnly ? '1-2' : '3-5'} minutes.`,
  });
});

// ============================================
// HELPERS
// ============================================

interface GenerationCheck {
  allowed: boolean;
  reason: string;
  useFreeGeneration: boolean;
}

async function checkGenerationLimits(
  user: any,
  pricingLevel: any
): Promise<GenerationCheck> {
  // Check free generations first
  if (user.freeGenerations > 0) {
    return { allowed: true, reason: '', useFreeGeneration: true };
  }
  
  // Check subscription
  if (user.subscriptionLevel === 0) {
    return {
      allowed: false,
      reason: 'Subscription required. Please subscribe to generate dreams.',
      useFreeGeneration: false,
    };
  }
  
  // Check subscription expiry
  if (user.subscriptionEnd && new Date(user.subscriptionEnd) < new Date()) {
    return {
      allowed: false,
      reason: 'Your subscription has expired. Please renew to continue.',
      useFreeGeneration: false,
    };
  }
  
  // Check monthly limit
  if (pricingLevel && pricingLevel.generationsPerMonth !== -1) {
    // Check if we need to reset the counter
    const now = new Date();
    if (!user.generationsResetAt || new Date(user.generationsResetAt) < now) {
      // Reset counter (will be done in decrementGenerations)
    } else if (user.generationsUsedThisMonth >= pricingLevel.generationsPerMonth) {
      return {
        allowed: false,
        reason: `You've reached your monthly limit of ${pricingLevel.generationsPerMonth} generations.`,
        useFreeGeneration: false,
      };
    }
  }
  
  return { allowed: true, reason: '', useFreeGeneration: false };
}

async function decrementGenerations(user: any) {
  const now = new Date();
  
  // Check if we should use free generation
  if (user.freeGenerations > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        freeGenerations: { decrement: 1 },
        totalGenerations: { increment: 1 },
      },
    });
    return;
  }
  
  // Calculate next reset date (anniversary-based)
  let resetAt = user.generationsResetAt;
  if (!resetAt || new Date(resetAt) < now) {
    // Set to one month from now
    resetAt = new Date(now);
    resetAt.setMonth(resetAt.getMonth() + 1);
  }
  
  // Reset counter if needed, then increment
  if (!user.generationsResetAt || new Date(user.generationsResetAt) < now) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        generationsUsedThisMonth: 1,
        generationsResetAt: resetAt,
        totalGenerations: { increment: 1 },
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        generationsUsedThisMonth: { increment: 1 },
        totalGenerations: { increment: 1 },
      },
    });
  }
}

export { app as dreamsRoutes };
