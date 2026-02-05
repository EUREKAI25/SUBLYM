/**
 * EURKAI Business Model Module
 *
 * Manages offers, subscriptions, quotas, permissions, and entitlements.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono();

app.use('*', cors());

// ===========================================
// IN-MEMORY STORE (Replace with Prisma in production)
// ===========================================

interface Plan {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  quotas: {
    maxDreams: number;
    maxPhotos: number;
    maxGenerationsPerMonth: number;
    canActivateMultipleDreams: boolean;
  };
  pricing: {
    monthly: number;
    yearly: number;
    oneTime?: number;
    currency: string;
  };
  features: string[];
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Découverte',
    description: 'Découvrez Sublym gratuitement',
    isActive: true,
    quotas: {
      maxDreams: 1,
      maxPhotos: 3,
      maxGenerationsPerMonth: 1,
      canActivateMultipleDreams: false,
    },
    pricing: {
      monthly: 0,
      yearly: 0,
      currency: 'EUR',
    },
    features: ['1 rêve actif', '3 photos max', '1 génération/mois'],
  },
  {
    id: 'essential',
    name: 'Essentiel',
    description: 'Pour une pratique régulière',
    isActive: true,
    quotas: {
      maxDreams: 3,
      maxPhotos: 6,
      maxGenerationsPerMonth: 5,
      canActivateMultipleDreams: false,
    },
    pricing: {
      monthly: 9.99,
      yearly: 99.99,
      currency: 'EUR',
    },
    features: ['3 rêves', '6 photos max', '5 générations/mois', 'Mode scroll/swipe'],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'L\'expérience complète',
    isActive: true,
    quotas: {
      maxDreams: -1, // Unlimited
      maxPhotos: 6,
      maxGenerationsPerMonth: -1, // Unlimited
      canActivateMultipleDreams: true,
    },
    pricing: {
      monthly: 19.99,
      yearly: 199.99,
      currency: 'EUR',
    },
    features: [
      'Rêves illimités',
      '6 photos max',
      'Générations illimitées',
      'Multi-rêves actifs',
      'Support prioritaire',
    ],
  },
];

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/plans
 * List all active plans
 */
app.get('/api/plans', (c) => {
  const activePlans = plans.filter((p) => p.isActive);
  return c.json({ plans: activePlans });
});

/**
 * GET /api/plans/:id
 * Get a specific plan
 */
app.get('/api/plans/:id', (c) => {
  const planId = c.req.param('id');
  const plan = plans.find((p) => p.id === planId);

  if (!plan) {
    return c.json({ error: 'Plan not found' }, 404);
  }

  return c.json({ plan });
});

/**
 * POST /api/entitlements/check
 * Check if a user has a specific entitlement
 */
app.post('/api/entitlements/check', zValidator('json', z.object({
  userId: z.string(),
  planId: z.string(),
  action: z.enum([
    'create_dream',
    'generate_images',
    'upload_photo',
    'activate_multiple_dreams',
  ]),
  context: z.record(z.any()).optional(),
})), async (c) => {
  const { userId, planId, action, context } = c.req.valid('json');

  const plan = plans.find((p) => p.id === planId);
  if (!plan) {
    return c.json({ allowed: false, reason: 'Invalid plan' }, 400);
  }

  // Check based on action
  let allowed = false;
  let reason = '';

  switch (action) {
    case 'create_dream':
      if (plan.quotas.maxDreams === -1) {
        allowed = true;
      } else {
        const currentDreams = context?.currentDreams || 0;
        allowed = currentDreams < plan.quotas.maxDreams;
        reason = allowed ? '' : `Limite de ${plan.quotas.maxDreams} rêves atteinte`;
      }
      break;

    case 'generate_images':
      if (plan.quotas.maxGenerationsPerMonth === -1) {
        allowed = true;
      } else {
        const currentGenerations = context?.currentGenerations || 0;
        allowed = currentGenerations < plan.quotas.maxGenerationsPerMonth;
        reason = allowed ? '' : `Limite de ${plan.quotas.maxGenerationsPerMonth} générations/mois atteinte`;
      }
      break;

    case 'upload_photo':
      const currentPhotos = context?.currentPhotos || 0;
      allowed = currentPhotos < plan.quotas.maxPhotos;
      reason = allowed ? '' : `Limite de ${plan.quotas.maxPhotos} photos atteinte`;
      break;

    case 'activate_multiple_dreams':
      allowed = plan.quotas.canActivateMultipleDreams;
      reason = allowed ? '' : 'Fonctionnalité réservée au plan Premium';
      break;
  }

  return c.json({
    allowed,
    reason,
    plan: {
      id: plan.id,
      name: plan.name,
    },
  });
});

/**
 * POST /api/quotas/usage
 * Record quota usage
 */
app.post('/api/quotas/usage', zValidator('json', z.object({
  userId: z.string(),
  type: z.enum(['generation', 'photo_upload', 'dream_create']),
  amount: z.number().int().positive().default(1),
})), async (c) => {
  const { userId, type, amount } = c.req.valid('json');

  // In production, this would update the database
  // For now, just acknowledge

  return c.json({
    recorded: true,
    userId,
    type,
    amount,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health
 */
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', module: 'business-model' });
});

// ===========================================
// SERVER
// ===========================================

const port = parseInt(process.env.PORT || '3011', 10);

console.log(`
╔═══════════════════════════════════════════════════╗
║        EURKAI Business Model Module               ║
╚═══════════════════════════════════════════════════╝
`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`💼 Business Model running on http://localhost:${info.port}`);
});

export default app;
