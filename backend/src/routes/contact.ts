// SUBLYM Backend - Contact Routes

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';
import { optionalAuthMiddleware, getOptionalAuthContext } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rate-limiter';
import { sendContactNotification } from '../services/brevo';

const app = new Hono();

const contactRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many contact requests. Please try again later.',
});

const contactSchema = z.object({
  email: z.string().email(),
  name: z.string().max(100).optional(),
  subject: z.string().max(200).optional(),
  message: z.string().min(10).max(5000),
});

// ============================================
// POST /contact
// ============================================

app.post('/', optionalAuthMiddleware, contactRateLimiter, zValidator('json', contactSchema), async (c) => {
  const data = c.req.valid('json');
  const auth = getOptionalAuthContext(c);
  
  const message = await prisma.contactMessage.create({
    data: {
      email: data.email,
      name: data.name,
      subject: data.subject,
      message: data.message,
      userId: auth?.user.id,
      status: 'new',
    },
  });
  
  // Send notification to admin
  try {
    await sendContactNotification(
      data.name || 'Anonymous',
      data.email,
      data.subject || 'No subject',
      data.message,
    );
  } catch (err) {
    console.error('Failed to send contact notification:', err);
  }
  
  return c.json({
    success: true,
    message: 'Your message has been sent. We will get back to you soon.',
    id: message.id,
  });
});

export { app as contactRoutes };
