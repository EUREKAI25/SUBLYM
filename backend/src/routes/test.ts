// SUBLYM Backend - Test Routes
// Development and testing endpoints

import { Hono } from 'hono';
import { prisma } from '../db';
import { adminMiddleware, superadminMiddleware } from '../middleware/auth';
import { ForbiddenError } from '../middleware/error-handler';

const app = new Hono();

// ============================================
// MIDDLEWARE - Protect test routes
// ============================================

app.use('*', async (c, next) => {
  // In development, allow without auth
  if (process.env.NODE_ENV === 'development') {
    await next();
    return;
  }
  
  // In production, require superadmin
  await adminMiddleware(c, async () => {
    await superadminMiddleware(c, next);
  });
});

// ============================================
// POST /test/generate-mock
// ============================================

app.post('/generate-mock', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { dreamId, userId } = body;
  
  if (!dreamId || !userId) {
    return c.json({ error: 'dreamId and userId required' }, 400);
  }
  
  const run = await prisma.run.create({
    data: {
      dreamId,
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      stepMessage: 'Mock generation complete',
      scenarioName: 'Mock Dream Journey',
      scenesCount: 5,
      duration: 30,
      videoPath: `users/${userId}/dreams/${dreamId}/final.mp4`,
      teaserPath: `users/${userId}/dreams/${dreamId}/teaser.jpg`,
      isPhotosOnly: false,
      costEur: 1.50,
      costDetails: { text: 0.05, image: 0.45, video: 1.00 },
      completedAt: new Date(),
    },
  });
  
  await prisma.dream.update({
    where: { id: dreamId },
    data: { status: 'completed' },
  });
  
  return c.json({
    success: true,
    run: { id: run.id, traceId: run.traceId, status: run.status },
  });
});

// ============================================
// GET /test/health-check-providers
// ============================================

app.get('/health-check-providers', async (c) => {
  const providers = await prisma.aIProvider.findMany({
    where: { enabled: true },
    orderBy: [{ category: 'asc' }, { priority: 'asc' }],
  });
  
  const results = providers.map((p) => ({
    name: p.name,
    category: p.category,
    status: 'ok',
    responseTime: Math.floor(Math.random() * 500) + 100,
  }));
  
  return c.json({
    success: true,
    providers: results,
    allHealthy: true,
  });
});

// ============================================
// POST /test/reset-user-generations
// ============================================

app.post('/reset-user-generations', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { userId, email } = body;
  
  const where = userId ? { id: userId } : email ? { email } : null;
  if (!where) return c.json({ error: 'userId or email required' }, 400);
  
  const user = await prisma.user.update({
    where,
    data: { generationsUsedThisMonth: 0, freeGenerations: 5 },
  });
  
  return c.json({ success: true, user: { id: user.id, email: user.email } });
});

// ============================================
// POST /test/simulate-payment
// ============================================

app.post('/simulate-payment', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { userId, level, period = 'monthly' } = body;
  
  if (!userId || !level) return c.json({ error: 'userId and level required' }, 400);
  
  const subscriptionEnd = new Date();
  period === 'yearly' 
    ? subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1)
    : subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
  
  const user = await prisma.user.update({
    where: { id: userId },
    data: { subscriptionLevel: level, subscriptionEnd, generationsUsedThisMonth: 0 },
  });
  
  return c.json({ success: true, user: { id: user.id, subscriptionLevel: user.subscriptionLevel } });
});

// ============================================
// GET /test/env
// ============================================

app.get('/env', async (c) => {
  if (process.env.NODE_ENV === 'production') {
    throw new ForbiddenError('Not available in production');
  }
  
  return c.json({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL ? '[SET]' : '[NOT SET]',
    STRIPE_MODE: process.env.STRIPE_SECRET_KEY_TEST ? 'test' : 'live',
    BREVO_API_KEY: process.env.BREVO_API_KEY ? '[SET]' : '[NOT SET]',
  });
});

export { app as testRoutes };
