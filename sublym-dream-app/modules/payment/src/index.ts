/**
 * EURKAI Payment Module
 *
 * Handles payments via Stripe: checkout sessions, webhooks, and payment records.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import Stripe from 'stripe';

const app = new Hono();

app.use('*', cors());

// Initialize Stripe (will be null if no key provided)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// ===========================================
// ROUTES
// ===========================================

/**
 * POST /api/checkout/session
 * Create a Stripe Checkout session
 */
app.post('/api/checkout/session', zValidator('json', z.object({
  userId: z.string(),
  planId: z.string(),
  period: z.enum(['monthly', 'yearly', 'one_time']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
})), async (c) => {
  if (!stripe) {
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  const { userId, planId, period, successUrl, cancelUrl } = c.req.valid('json');

  // In production, fetch price ID from database based on planId and period
  // For now, use placeholder
  const priceId = `price_${planId}_${period}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: period === 'one_time' ? 'payment' : 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${APP_URL}/payment/cancel`,
      metadata: {
        userId,
        planId,
        period,
      },
    });

    return c.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

/**
 * POST /api/checkout/portal
 * Create a Stripe Customer Portal session
 */
app.post('/api/checkout/portal', zValidator('json', z.object({
  customerId: z.string(),
  returnUrl: z.string().url().optional(),
})), async (c) => {
  if (!stripe) {
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  const { customerId, returnUrl } = c.req.valid('json');

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${APP_URL}/settings`,
    });

    return c.json({ url: session.url });
  } catch (error) {
    console.error('Stripe portal error:', error);
    return c.json({ error: 'Failed to create portal session' }, 500);
  }
});

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhooks
 */
app.post('/api/webhooks/stripe', async (c) => {
  if (!stripe) {
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  let event: Stripe.Event;

  try {
    const body = await c.req.text();
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Checkout completed:', session.id);

      // In production:
      // 1. Get userId from session.metadata
      // 2. Update user's subscription in database
      // 3. Create payment record
      // 4. Send confirmation email

      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log('Subscription updated:', subscription.id);

      // Handle subscription changes (upgrade, downgrade, cancel)
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log('Subscription canceled:', subscription.id);

      // Handle subscription cancellation
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log('Payment succeeded:', invoice.id);

      // Record successful payment
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log('Payment failed:', invoice.id);

      // Handle failed payment (notify user, retry logic)
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return c.json({ received: true });
});

/**
 * GET /api/payments/:userId
 * Get payment history for a user
 */
app.get('/api/payments/:userId', async (c) => {
  const userId = c.req.param('userId');

  // In production, fetch from database
  // For now, return empty array
  return c.json({
    payments: [],
    userId,
  });
});

/**
 * GET /api/health
 */
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    module: 'payment',
    stripeConfigured: !!stripe,
  });
});

// ===========================================
// SERVER
// ===========================================

const port = parseInt(process.env.PORT || '3012', 10);

console.log(`
╔═══════════════════════════════════════════════════╗
║        EURKAI Payment Module                      ║
╚═══════════════════════════════════════════════════╝
`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`💳 Payment running on http://localhost:${info.port}`);
  console.log(`   Stripe: ${stripe ? 'configured' : 'not configured'}`);
});

export default app;
