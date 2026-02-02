// SUBLYM Backend - Subscription Routes

import { Hono } from 'hono';
import { prisma } from '../db';
import { authMiddleware, getAuthContext } from '../middleware/auth';
import { ValidationError } from '../middleware/error-handler';
import { getStripeClient } from '../services/stripe';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// ============================================
// GET /subscription
// ============================================

app.get('/', async (c) => {
  const { user } = getAuthContext(c);
  
  // Get pricing level details
  const pricingLevel = await prisma.pricingLevel.findUnique({
    where: { level: user.subscriptionLevel },
  });
  
  // Calculate remaining generations
  let generationsRemaining: number | 'unlimited' = 0;
  
  if (pricingLevel) {
    if (pricingLevel.generationsPerMonth === -1) {
      generationsRemaining = 'unlimited';
    } else {
      generationsRemaining = Math.max(
        0,
        pricingLevel.generationsPerMonth - user.generationsUsedThisMonth
      );
    }
  }
  
  // Add free generations
  const totalRemaining = generationsRemaining === 'unlimited'
    ? 'unlimited'
    : generationsRemaining + user.freeGenerations;
  
  return c.json({
    level: user.subscriptionLevel,
    levelName: pricingLevel?.name || 'Gratuit',
    subscriptionEnd: user.subscriptionEnd,
    subscriptionCancelAt: user.subscriptionCancelAt,
    isCancelled: !!user.subscriptionCancelAt,
    features: pricingLevel ? {
      photosMin: pricingLevel.photosMin,
      photosMax: pricingLevel.photosMax,
      keyframesCount: pricingLevel.keyframesCount,
      videoEnabled: pricingLevel.videoEnabled,
      scenesCount: pricingLevel.scenesCount,
      generationsPerMonth: pricingLevel.generationsPerMonth,
      subliminalEnabled: pricingLevel.subliminalEnabled,
    } : null,
    usage: {
      generationsUsedThisMonth: user.generationsUsedThisMonth,
      generationsPerMonth: pricingLevel?.generationsPerMonth || 0,
      generationsRemaining: totalRemaining,
      freeGenerations: user.freeGenerations,
      totalGenerations: user.totalGenerations,
      resetAt: user.generationsResetAt,
    },
    stripe: {
      customerId: user.stripeCustomerId,
      subscriptionId: user.stripeSubscriptionId,
    },
  });
});

// ============================================
// POST /subscription/cancel
// ============================================

app.post('/cancel', async (c) => {
  const { user } = getAuthContext(c);
  
  if (user.subscriptionLevel === 0) {
    throw new ValidationError('You do not have an active subscription');
  }
  
  if (!user.stripeSubscriptionId) {
    throw new ValidationError('No Stripe subscription found');
  }
  
  if (user.subscriptionCancelAt) {
    throw new ValidationError('Subscription is already scheduled for cancellation');
  }
  
  const stripe = await getStripeClient();
  
  // Cancel at period end (not immediately)
  const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
  
  // Update user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionCancelAt: new Date(subscription.current_period_end * 1000),
    },
  });
  
  return c.json({
    success: true,
    message: 'Subscription will be cancelled at the end of the current period',
    cancelAt: new Date(subscription.current_period_end * 1000),
    accessUntil: new Date(subscription.current_period_end * 1000),
  });
});

// ============================================
// POST /subscription/reactivate
// ============================================

app.post('/reactivate', async (c) => {
  const { user } = getAuthContext(c);
  
  if (!user.stripeSubscriptionId) {
    throw new ValidationError('No Stripe subscription found');
  }
  
  if (!user.subscriptionCancelAt) {
    throw new ValidationError('Subscription is not scheduled for cancellation');
  }
  
  const stripe = await getStripeClient();
  
  // Reactivate subscription
  await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
  
  // Update user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionCancelAt: null,
    },
  });
  
  return c.json({
    success: true,
    message: 'Subscription reactivated successfully',
  });
});

// ============================================
// POST /subscription/portal
// ============================================

app.post('/portal', async (c) => {
  const { user } = getAuthContext(c);
  const returnUrl = c.req.query('returnUrl') || process.env.APP_URL || 'https://sublym.org';
  
  if (!user.stripeCustomerId) {
    throw new ValidationError('No Stripe customer found');
  }
  
  const stripe = await getStripeClient();
  
  // Create billing portal session
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });
  
  return c.json({
    success: true,
    url: session.url,
  });
});

// ============================================
// GET /subscription/invoices
// ============================================

app.get('/invoices', async (c) => {
  const { user } = getAuthContext(c);
  
  if (!user.stripeCustomerId) {
    return c.json({ invoices: [] });
  }
  
  const stripe = await getStripeClient();
  
  try {
    const invoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 12,
    });
    
    return c.json({
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        amount: inv.amount_paid / 100,
        currency: inv.currency?.toUpperCase(),
        status: inv.status,
        pdfUrl: inv.invoice_pdf,
        createdAt: new Date(inv.created * 1000),
        paidAt: inv.status_transitions?.paid_at
          ? new Date(inv.status_transitions.paid_at * 1000)
          : null,
      })),
    });
  } catch (err) {
    console.error('Failed to fetch invoices:', err);
    return c.json({ invoices: [] });
  }
});

export { app as subscriptionRoutes };
