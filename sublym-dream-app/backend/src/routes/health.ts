import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';

export const healthRoutes = new Hono();

/**
 * GET /api/health
 * Basic health check
 */
healthRoutes.get('/', async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * GET /api/health/ready
 * Readiness check (includes DB)
 */
healthRoutes.get('/ready', async (c) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    return c.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
      },
    });
  } catch (error) {
    return c.json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'error',
      },
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    }, 503);
  }
});

/**
 * GET /api/health/live
 * Liveness check
 */
healthRoutes.get('/live', (c) => {
  return c.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
