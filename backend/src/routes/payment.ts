// SUBLYM Backend - Payment Routes
// Stripe integration

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';
import { authMiddleware, getAuthContext } from '../middleware/auth';
import { ValidationError } from '../middleware/error-handler';
import { 
  createCheckoutSession, 
  getStripeClient, 
  constructWebhookEvent 
} from '../services/stripe';

const app = new Hono();

// ============================================
// SCHEMAS
// ============================================

const createSessionSchema = z.object({
  level: z.number().int().min(1).max(3),
  period: z.enum(['monthly', 'yearly']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// ============================================
// POST /payment/create-session
// ============================================

app.post('/create-session', authMiddleware, zValidator('json', createSessionSchema), async (c) => {
  const { user } = getAuthContext(c);
  const data = c.req.valid('json');
  
  // Check if user already has this subscription level
  if (user.subscriptionLevel >= data.level) {
    throw new ValidationError('You already have this subscription level or higher');
  }
  
  // Get pricing level
  const pricingLevel = await prisma.pricingLevel.findUnique({
    where: { level: data.level },
  });
  
  if (!pricingLevel || !pricingLevel.enabled) {
    throw new ValidationError('Invalid subscription level');
  }
  
  // Create Stripe checkout session
  const session = await createCheckoutSession(
    user.id,
    user.email,
    data.level,
    data.period,
    Number(data.period === 'yearly' ? pricingLevel.priceYearly : pricingLevel.priceMonthly),
    pricingLevel.name,
    data.successUrl,
    data.cancelUrl
  );
  
  return c.json({
    success: true,
    sessionId: session.sessionId,
    url: session.url,
  });
});

// ============================================
// POST /payment/webhook
// ============================================

app.post('/webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  const rawBody = await c.req.text();
  
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }
  
  let event;
  try {
    event = await constructWebhookEvent(rawBody, signature);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return c.json({ error: 'Invalid signature' }, 400);
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      await handleCheckoutComplete(session);
      break;
    }
    
    case 'invoice.paid': {
      const invoice = event.data.object;
      await handleInvoicePaid(invoice);
      break;
    }
    
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      await handlePaymentFailed(invoice);
      break;
    }
    
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      await handleSubscriptionUpdated(subscription);
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await handleSubscriptionDeleted(subscription);
      break;
    }
    
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
  
  return c.json({ received: true });
});

// ============================================
// GET /payment/status/:sessionId
// ============================================

app.get('/status/:sessionId', authMiddleware, async (c) => {
  const { user } = getAuthContext(c);
  const sessionId = c.req.param('sessionId');
  
  const stripe = await getStripeClient();
  
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Verify this session belongs to this user
    if (session.metadata?.userId !== user.id.toString()) {
      return c.json({
        error: 'UNAUTHORIZED',
        message: 'This session does not belong to you',
      }, 403);
    }
    
    return c.json({
      status: session.status,
      paymentStatus: session.payment_status,
      subscriptionId: session.subscription,
    });
  } catch (err) {
    return c.json({
      error: 'SESSION_NOT_FOUND',
      message: 'Session not found',
    }, 404);
  }
});

// ============================================
// GET /payment/history
// ============================================

app.get('/history', authMiddleware, async (c) => {
  const { user } = getAuthContext(c);
  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '10');
  
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.payment.count({ where: { userId: user.id } }),
  ]);
  
  return c.json({
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount / 100, // Convert from cents
      currency: p.currency,
      status: p.status,
      productType: p.productType,
      productLevel: p.productLevel,
      period: p.period,
      createdAt: p.createdAt,
      refundedAt: p.refundedAt,
    })),
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  });
});

// ============================================
// WEBHOOK HANDLERS
// ============================================

async function handleCheckoutComplete(session: any) {
  const userId = parseInt(session.metadata?.userId);
  const level = parseInt(session.metadata?.level);
  
  if (!userId || !level) {
    console.error('Missing metadata in checkout session');
    return;
  }
  
  // Calculate subscription end date
  const period = session.metadata?.period || 'monthly';
  const subscriptionEnd = new Date();
  if (period === 'yearly') {
    subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
  } else {
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
  }
  
  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionLevel: level,
      subscriptionEnd,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      // Reset monthly generation counter on new subscription
      generationsUsedThisMonth: 0,
      generationsResetAt: subscriptionEnd,
    },
  });
  
  // Create payment record
  await prisma.payment.create({
    data: {
      stripePaymentId: session.payment_intent || session.id,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      userId,
      email: session.customer_email || '',
      amount: session.amount_total,
      currency: session.currency?.toUpperCase() || 'EUR',
      status: 'succeeded',
      productType: 'subscription',
      productLevel: level,
      period,
    },
  });
  
  console.log(`User ${userId} subscribed to level ${level}`);
}

async function handleInvoicePaid(invoice: any) {
  const subscriptionId = invoice.subscription;
  
  if (!subscriptionId) return;
  
  // Find user by subscription ID
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });
  
  if (!user) {
    console.error(`User not found for subscription ${subscriptionId}`);
    return;
  }
  
  // Extend subscription
  const subscriptionEnd = new Date();
  const period = invoice.billing_reason === 'subscription_cycle' ? 'monthly' : 'yearly';
  if (period === 'yearly') {
    subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
  } else {
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
  }
  
  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionEnd,
      // Reset monthly generation counter on renewal
      generationsUsedThisMonth: 0,
      generationsResetAt: subscriptionEnd,
    },
  });
  
  // Create payment record
  await prisma.payment.create({
    data: {
      stripePaymentId: invoice.payment_intent || invoice.id,
      stripeCustomerId: invoice.customer,
      stripeSubscriptionId: subscriptionId,
      stripeInvoiceId: invoice.id,
      userId: user.id,
      email: user.email,
      amount: invoice.amount_paid,
      currency: invoice.currency?.toUpperCase() || 'EUR',
      status: 'succeeded',
      productType: 'subscription',
      productLevel: user.subscriptionLevel,
      period,
    },
  });
  
  console.log(`Invoice paid for user ${user.id}`);
}

async function handlePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  
  if (!subscriptionId) return;
  
  // Find user by subscription ID
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });
  
  if (!user) return;
  
  // Create failed payment record
  await prisma.payment.create({
    data: {
      stripePaymentId: invoice.payment_intent || invoice.id,
      stripeCustomerId: invoice.customer,
      stripeSubscriptionId: subscriptionId,
      stripeInvoiceId: invoice.id,
      userId: user.id,
      email: user.email,
      amount: invoice.amount_due,
      currency: invoice.currency?.toUpperCase() || 'EUR',
      status: 'failed',
      productType: 'subscription',
      productLevel: user.subscriptionLevel,
    },
  });
  
  // TODO: Send email notification about failed payment
  
  console.log(`Payment failed for user ${user.id}`);
}

async function handleSubscriptionUpdated(subscription: any) {
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });
  
  if (!user) return;
  
  // Handle cancellation scheduled
  if (subscription.cancel_at_period_end) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionCancelAt: new Date(subscription.current_period_end * 1000),
      },
    });
    console.log(`Subscription cancellation scheduled for user ${user.id}`);
  } else {
    // Cancellation reverted
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionCancelAt: null,
      },
    });
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });
  
  if (!user) return;
  
  // Downgrade to free
  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionLevel: 0,
      subscriptionEnd: null,
      subscriptionCancelAt: null,
      stripeSubscriptionId: null,
    },
  });
  
  console.log(`Subscription deleted for user ${user.id}`);
}

export { app as paymentRoutes };
