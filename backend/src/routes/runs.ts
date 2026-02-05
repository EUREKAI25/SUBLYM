// SUBLYM Backend - Runs Routes
// Generation status and results

import { Hono } from 'hono';
import * as fs from 'fs/promises';
import * as path from 'path';
import { prisma } from '../db';
import { authMiddleware, getAuthContext } from '../middleware/auth';
import { NotFoundError, ForbiddenError } from '../middleware/error-handler';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

// ============================================
// GET /runs - List user's runs
// ============================================

app.get('/', async (c) => {
  const { user } = getAuthContext(c);

  const runs = await prisma.run.findMany({
    where: {
      dream: { userId: user.id },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      dream: { select: { id: true, description: true } },
    },
  });

  return c.json({
    runs: runs.map((r) => ({
      id: r.id,
      dreamId: r.dreamId,
      traceId: r.traceId,
      status: r.status,
      progress: r.progress,
      videoUrl: r.videoPath ? `/storage/${r.videoPath}` : null,
      teaserUrl: r.teaserPath ? `/storage/${r.teaserPath}` : null,
      keyframesUrls: r.keyframesPaths
        ? (r.keyframesPaths as string[]).map((p) => `/storage/${p}`)
        : [],
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      dream: r.dream,
    })),
  });
});

// ============================================
// GET /runs/:traceId
// ============================================

app.get('/:traceId', async (c) => {
  const { user } = getAuthContext(c);
  const traceId = c.req.param('traceId');
  
  const run = await prisma.run.findUnique({
    where: { traceId },
    include: {
      dream: {
        select: { userId: true },
      },
    },
  });
  
  if (!run) {
    throw new NotFoundError('Run');
  }
  
  if (run.dream.userId !== user.id) {
    throw new ForbiddenError('You cannot access this run');
  }
  
  // If generating, try to read progress file
  let progress = run.progress;
  let currentStep = run.currentStep;
  let stepMessage = run.stepMessage;
  
  if (run.status === 'generating') {
    const progressFile = path.join(
      STORAGE_PATH,
      'users',
      user.id.toString(),
      'dreams',
      run.dreamId.toString(),
      'progress.json'
    );
    
    try {
      const progressData = await fs.readFile(progressFile, 'utf-8');
      const parsed = JSON.parse(progressData);
      progress = parsed.progress ?? progress;
      currentStep = parsed.step ?? currentStep;
      stepMessage = parsed.message ?? stepMessage;
    } catch {
      // Progress file not found or invalid, use DB values
    }
  }
  
  // Calculate estimated remaining time
  let estimatedRemaining = null;
  if (run.status === 'generating' && progress > 0) {
    const elapsed = Date.now() - new Date(run.createdAt).getTime();
    const totalEstimated = (elapsed / progress) * 100;
    estimatedRemaining = Math.max(0, Math.round((totalEstimated - elapsed) / 1000));
  }
  
  // Base response
  const response: any = {
    traceId: run.traceId,
    status: run.status,
    progress,
    currentStep,
    stepMessage,
    estimatedRemaining,
    isPhotosOnly: run.isPhotosOnly,
    createdAt: run.createdAt,
  };
  
  // Add completion data if completed
  if (run.status === 'completed') {
    response.scenarioName = run.scenarioName;
    response.scenesCount = run.scenesCount;
    response.duration = run.duration;
    response.completedAt = run.completedAt;

    if (run.isPhotosOnly) {
      response.keyframesZipUrl = run.keyframesZipPath
        ? `/storage/${run.keyframesZipPath}`
        : null;
    } else {
      response.videoUrl = run.videoPath
        ? `/storage/${run.videoPath}`
        : null;
    }

    response.teaserUrl = run.teaserPath
      ? `/storage/${run.teaserPath}`
      : null;

    // Add keyframes URLs (used for blurred thumbnail in Smile recording)
    response.keyframesUrls = run.keyframesPaths
      ? (run.keyframesPaths as string[]).map((p) => `/storage/${p}`)
      : [];

    // Only show cost to user in dev mode
    if (process.env.NODE_ENV === 'development') {
      response.costEur = run.costEur;
    }
  }
  
  // Add error data if failed
  if (run.status === 'failed') {
    response.error = run.error;
    response.canRetry = run.canRetry;
  }
  
  return c.json(response);
});

// ============================================
// GET /runs/:traceId/video
// ============================================

app.get('/:traceId/video', async (c) => {
  const { user } = getAuthContext(c);
  const traceId = c.req.param('traceId');
  
  const run = await prisma.run.findUnique({
    where: { traceId },
    include: {
      dream: {
        select: { userId: true },
      },
    },
  });
  
  if (!run) {
    throw new NotFoundError('Run');
  }
  
  if (run.dream.userId !== user.id) {
    throw new ForbiddenError('You cannot access this run');
  }
  
  if (run.status !== 'completed') {
    return c.json({
      error: 'NOT_READY',
      message: 'Video is not ready yet',
      status: run.status,
    }, 400);
  }
  
  if (run.isPhotosOnly) {
    return c.json({
      error: 'NO_VIDEO',
      message: 'This is a photos-only generation',
      keyframesZipUrl: run.keyframesZipPath
        ? `/storage/${run.keyframesZipPath}`
        : null,
    }, 400);
  }
  
  if (!run.videoPath) {
    return c.json({
      error: 'VIDEO_NOT_FOUND',
      message: 'Video file not found',
    }, 404);
  }
  
  return c.json({
    url: `/storage/${run.videoPath}`,
    duration: run.duration,
    scenarioName: run.scenarioName,
    scenesCount: run.scenesCount,
  });
});

// ============================================
// GET /runs/:traceId/teaser
// ============================================

app.get('/:traceId/teaser', async (c) => {
  const { user } = getAuthContext(c);
  const traceId = c.req.param('traceId');
  
  const run = await prisma.run.findUnique({
    where: { traceId },
    include: {
      dream: {
        select: { userId: true },
      },
    },
  });
  
  if (!run) {
    throw new NotFoundError('Run');
  }
  
  if (run.dream.userId !== user.id) {
    throw new ForbiddenError('You cannot access this run');
  }
  
  if (!run.teaserPath) {
    return c.json({
      error: 'TEASER_NOT_FOUND',
      message: 'Teaser not available yet',
    }, 404);
  }
  
  return c.json({
    url: `/storage/${run.teaserPath}`,
  });
});

// ============================================
// GET /runs/:traceId/keyframes
// ============================================

app.get('/:traceId/keyframes', async (c) => {
  const { user } = getAuthContext(c);
  const traceId = c.req.param('traceId');
  
  const run = await prisma.run.findUnique({
    where: { traceId },
    include: {
      dream: {
        select: { userId: true },
      },
    },
  });
  
  if (!run) {
    throw new NotFoundError('Run');
  }
  
  if (run.dream.userId !== user.id) {
    throw new ForbiddenError('You cannot access this run');
  }
  
  if (run.status !== 'completed') {
    return c.json({
      error: 'NOT_READY',
      message: 'Keyframes are not ready yet',
    }, 400);
  }
  
  // List keyframe files
  const keyframesDir = path.join(
    STORAGE_PATH,
    'users',
    user.id.toString(),
    'dreams',
    run.dreamId.toString(),
    'keyframes'
  );
  
  try {
    const files = await fs.readdir(keyframesDir);
    const keyframes = files
      .filter((f) => f.endsWith('.png') || f.endsWith('.jpg'))
      .sort()
      .map((f) => ({
        filename: f,
        url: `/storage/users/${user.id}/dreams/${run.dreamId}/keyframes/${f}`,
      }));
    
    return c.json({
      keyframes,
      zipUrl: run.keyframesZipPath
        ? `/storage/${run.keyframesZipPath}`
        : null,
    });
  } catch {
    return c.json({
      error: 'KEYFRAMES_NOT_FOUND',
      message: 'Keyframes directory not found',
    }, 404);
  }
});

// ============================================
// POST /runs/:traceId/cancel
// ============================================

app.post('/:traceId/cancel', async (c) => {
  const { user } = getAuthContext(c);
  const traceId = c.req.param('traceId');
  
  const run = await prisma.run.findUnique({
    where: { traceId },
    include: {
      dream: {
        select: { userId: true, id: true },
      },
    },
  });
  
  if (!run) {
    throw new NotFoundError('Run');
  }
  
  if (run.dream.userId !== user.id) {
    throw new ForbiddenError('You cannot cancel this run');
  }
  
  if (run.status !== 'pending' && run.status !== 'generating') {
    return c.json({
      error: 'CANNOT_CANCEL',
      message: `Cannot cancel run with status: ${run.status}`,
    }, 400);
  }
  
  // Update run status
  await prisma.run.update({
    where: { id: run.id },
    data: {
      status: 'failed',
      error: 'Cancelled by user',
      canRetry: true,
    },
  });
  
  // Update dream status
  await prisma.dream.update({
    where: { id: run.dream.id },
    data: { status: 'draft' },
  });
  
  // TODO: Actually kill the Python process if running
  
  // Refund the generation (give back)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      // This is a simplification - ideally track which type was used
      freeGenerations: { increment: 1 },
      totalGenerations: { decrement: 1 },
    },
  });
  
  return c.json({
    success: true,
    message: 'Generation cancelled. Your generation credit has been refunded.',
  });
});

export { app as runsRoutes };
