import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';

export const configRoutes = new Hono();

/**
 * GET /api/config/public
 * Get public configuration (no auth required)
 */
configRoutes.get('/public', async (c) => {
  const configs = await prisma.config.findMany({
    where: {
      category: { in: ['public', 'analytics'] },
    },
  });

  const configMap: Record<string, any> = {};
  for (const config of configs) {
    let value: any = config.value;
    if (config.type === 'number') value = parseFloat(config.value);
    if (config.type === 'boolean') value = config.value === 'true';
    if (config.type === 'json') value = JSON.parse(config.value);
    configMap[config.key] = value;
  }

  return c.json({
    config: configMap,
    // Analytics IDs (from env, configured later)
    analytics: {
      gtmId: process.env.GTM_ID || null,
      ga4Id: process.env.GA4_ID || null,
    },
  });
});
