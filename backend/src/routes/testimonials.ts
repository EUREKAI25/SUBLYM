// SUBLYM Backend - Testimonials Routes

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { prisma } from '../db';
import { authMiddleware, getAuthContext, optionalAuthMiddleware } from '../middleware/auth';
import { uploadRateLimiter } from '../middleware/rate-limiter';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const app = new Hono();

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

// ============================================
// SCHEMAS
// ============================================

const createTestimonialSchema = z.object({
  text: z.string().min(10).max(2000),
  rating: z.number().int().min(1).max(5).optional(),
  consentDisplay: z.boolean(),
  consentMarketing: z.boolean().optional(),
});

// ============================================
// GET /testimonials/public
// ============================================

app.get('/public', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '20');
  
  const [testimonials, total] = await Promise.all([
    prisma.testimonial.findMany({
      where: { 
        status: 'approved',
        consentDisplay: true,
      },
      orderBy: { approvedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        text: true,
        rating: true,
        proofPath: true,
        videoPath: true,
        approvedAt: true,
        user: {
          select: {
            firstName: true,
            country: true,
          },
        },
      },
    }),
    prisma.testimonial.count({
      where: { status: 'approved', consentDisplay: true },
    }),
  ]);
  
  return c.json({
    testimonials: testimonials.map((t) => ({
      id: t.id,
      text: t.text,
      rating: t.rating,
      proofUrl: t.proofPath ? `/storage/${t.proofPath}` : null,
      videoUrl: t.videoPath ? `/storage/${t.videoPath}` : null,
      author: t.user.firstName,
      country: t.user.country,
      date: t.approvedAt,
    })),
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });
});

// ============================================
// POST /testimonials
// ============================================

app.post('/', authMiddleware, uploadRateLimiter, zValidator('json', createTestimonialSchema), async (c) => {
  const { user } = getAuthContext(c);
  const data = c.req.valid('json');
  
  // Check if user already has a pending testimonial
  const existing = await prisma.testimonial.findFirst({
    where: { userId: user.id, status: 'pending' },
  });
  
  if (existing) {
    throw new ValidationError('You already have a pending testimonial');
  }
  
  const testimonial = await prisma.testimonial.create({
    data: {
      userId: user.id,
      text: data.text,
      rating: data.rating,
      consentDisplay: data.consentDisplay,
      consentMarketing: data.consentMarketing || false,
      status: 'pending',
    },
  });
  
  return c.json({
    success: true,
    testimonial: {
      id: testimonial.id,
      status: testimonial.status,
    },
    message: 'Thank you! Your testimonial is pending review.',
  }, 201);
});

// ============================================
// POST /testimonials/:id/proof
// ============================================

app.post('/:id/proof', authMiddleware, uploadRateLimiter, async (c) => {
  const { user } = getAuthContext(c);
  const testimonialId = parseInt(c.req.param('id'));
  
  const testimonial = await prisma.testimonial.findUnique({
    where: { id: testimonialId },
  });
  
  if (!testimonial || testimonial.userId !== user.id) {
    throw new NotFoundError('Testimonial');
  }
  
  const formData = await c.req.formData();
  const file = formData.get('proof') as File;
  
  if (!file) {
    throw new ValidationError('No file provided');
  }
  
  // Determine if image or video
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  
  if (!isVideo && !isImage) {
    throw new ValidationError('File must be an image or video');
  }
  
  // Save file
  const testimonialDir = path.join(STORAGE_PATH, 'testimonials', testimonialId.toString());
  await fs.mkdir(testimonialDir, { recursive: true });
  
  const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
  const filename = `proof.${ext}`;
  const filePath = path.join(testimonialDir, filename);
  const relativePath = `testimonials/${testimonialId}/${filename}`;
  
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);
  
  // Update testimonial
  await prisma.testimonial.update({
    where: { id: testimonialId },
    data: isVideo ? { videoPath: relativePath } : { proofPath: relativePath },
  });
  
  return c.json({
    success: true,
    message: 'Proof uploaded successfully',
  });
});

// ============================================
// GET /testimonials/mine
// ============================================

app.get('/mine', authMiddleware, async (c) => {
  const { user } = getAuthContext(c);
  
  const testimonials = await prisma.testimonial.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  
  return c.json({
    testimonials: testimonials.map((t) => ({
      id: t.id,
      text: t.text,
      rating: t.rating,
      status: t.status,
      rejectionReason: t.rejectionReason,
      proofUrl: t.proofPath ? `/storage/${t.proofPath}` : null,
      videoUrl: t.videoPath ? `/storage/${t.videoPath}` : null,
      createdAt: t.createdAt,
      approvedAt: t.approvedAt,
    })),
  });
});

export { app as testimonialsRoutes };
