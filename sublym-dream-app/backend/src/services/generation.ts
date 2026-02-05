import { prisma } from '../lib/prisma.js';
import { getSignedUrl } from './storage.js';

const GENERATION_API_URL = process.env.GENERATION_API_URL || 'http://localhost:8000/api/generate';
const GENERATION_API_KEY = process.env.GENERATION_API_KEY || '';

interface GenerationPayload {
  traceId: string;
  dream: {
    description: string;
    reject: string | null;
  };
  userPhotos: Array<{
    id: string;
    url: string;
  }>;
  options: {
    imagesCount: number;
  };
}

/**
 * Trigger image generation for a dream
 * This is async - it queues the job and returns immediately
 */
export async function triggerGeneration(jobId: string): Promise<void> {
  // Don't await - let it run in the background
  processGeneration(jobId).catch(async (error) => {
    console.error(`Generation job ${jobId} failed:`, error);
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: error.message || 'Unknown error',
        completedAt: new Date(),
      },
    });
  });
}

async function processGeneration(jobId: string): Promise<void> {
  // Get job with dream and user photos
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    include: {
      dream: {
        include: {
          imageAssets: {
            where: { kind: 'user_photo', deletedAt: null },
          },
        },
      },
    },
  });

  if (!job || !job.dream) {
    throw new Error('Job or dream not found');
  }

  // Update status to running
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      startedAt: new Date(),
      progress: 0,
      stepMessage: 'Préparation des images...',
    },
  });

  // Get signed URLs for user photos
  const userPhotos = await Promise.all(
    job.dream.imageAssets.map(async (asset) => ({
      id: asset.id,
      url: await getSignedUrl(asset.storageKey),
    }))
  );

  // Prepare payload for generation engine
  const payload: GenerationPayload = {
    traceId: job.traceId,
    dream: {
      description: job.dream.description,
      reject: job.dream.rejectText,
    },
    userPhotos,
    options: {
      imagesCount: 10, // Default number of images to generate
    },
  };

  // Call generation API
  const response = await fetch(GENERATION_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GENERATION_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Generation API error: ${error}`);
  }

  const result = await response.json();

  // Update progress
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      progress: 50,
      stepMessage: 'Génération en cours...',
    },
  });

  // The generation engine should call back with results
  // For now, we simulate completion
  // In production, this would be handled by a webhook

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'succeeded',
      progress: 100,
      stepMessage: 'Terminé',
      imagesCount: result.imagesCount || 0,
      completedAt: new Date(),
    },
  });
}

/**
 * Handle webhook from generation engine
 * Called when generation is complete or fails
 */
export async function handleGenerationWebhook(
  traceId: string,
  status: 'succeeded' | 'failed',
  data: {
    images?: Array<{ url: string; width: number; height: number }>;
    error?: string;
    costEur?: number;
    costDetails?: Record<string, number>;
  }
): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { traceId },
    include: { dream: true },
  });

  if (!job) {
    console.error(`Job not found for traceId: ${traceId}`);
    return;
  }

  if (status === 'failed') {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        error: data.error || 'Generation failed',
        completedAt: new Date(),
      },
    });
    return;
  }

  // Create image assets from generated images
  if (data.images && data.images.length > 0) {
    await prisma.imageAsset.createMany({
      data: data.images.map((img) => ({
        userId: job.dream.userId,
        dreamId: job.dreamId,
        kind: 'dream_image',
        source: 'ai',
        storageKey: img.url, // Should be the S3 key
        width: img.width,
        height: img.height,
        format: 'webp',
      })),
    });
  }

  // Update job
  await prisma.generationJob.update({
    where: { id: job.id },
    data: {
      status: 'succeeded',
      progress: 100,
      stepMessage: 'Terminé',
      imagesCount: data.images?.length || 0,
      costEur: data.costEur,
      costDetails: data.costDetails,
      completedAt: new Date(),
    },
  });

  // Log
  await prisma.auditLog.create({
    data: {
      action: 'GENERATION_COMPLETE',
      actor: 'system',
      target: `dream:${job.dreamId}`,
      details: {
        jobId: job.id,
        imagesCount: data.images?.length || 0,
        costEur: data.costEur,
      },
    },
  });
}
