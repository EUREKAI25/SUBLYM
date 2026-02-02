// SUBLYM Backend - Stripe Service

import Stripe from 'stripe';
import { prisma } from '../db';

let stripeClient: Stripe | null = null;

// ============================================
// GET STRIPE CLIENT
// ============================================

export async function getStripeClient(): Promise<Stripe> {
  if (stripeClient) {
    return stripeClient;
  }
  
  // Check mode from config
  const modeConfig = await prisma.config.findUnique({
    where: { key: 'stripe_mode' },
  });
  
  const isTest = modeConfig?.value !== 'live';
  
  const secretKey = isTest
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY_LIVE;
  
  if (!secretKey) {
    throw new Error('Stripe secret key not configured');
  }
  
  stripeClient = new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  });
  
  return stripeClient;
}

// Reset client (for mode switching)
export function resetStripeClient(): void {
  stripeClient = null;
}

// ============================================
// CREATE CHECKOUT SESSION
// ============================================

export async function createCheckoutSession(
  userId: number,
  email: string,
  level: number,
  period: 'monthly' | 'yearly',
  price: number,
  productName: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
  const stripe = await getStripeClient();
  
  // Convert price to cents
  const unitAmount = Math.round(price * 100);
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Sublym - ${productName}`,
            description: `Subscription ${period === 'yearly' ? 'yearly' : 'monthly'}`,
          },
          unit_amount: unitAmount,
          recurring: {
            interval: period === 'yearly' ? 'year' : 'month',
          },
        },
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: userId.toString(),
      level: level.toString(),
      period,
    },
    subscription_data: {
      metadata: {
        userId: userId.toString(),
        level: level.toString(),
      },
    },
  });
  
  return {
    sessionId: session.id,
    url: session.url!,
  };
}

// ============================================
// CONSTRUCT WEBHOOK EVENT
// ============================================

export async function constructWebhookEvent(
  payload: string,
  signature: string
): Promise<Stripe.Event> {
  const stripe = await getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('Stripe webhook secret not configured');
  }
  
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

// ============================================
// CANCEL SUBSCRIPTION
// ============================================

export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription> {
  const stripe = await getStripeClient();
  
  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId);
  }
  
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

// ============================================
// REACTIVATE SUBSCRIPTION
// ============================================

export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = await getStripeClient();
  
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

// ============================================
// GET CUSTOMER PORTAL URL
// ============================================

export async function getCustomerPortalUrl(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = await getStripeClient();
  
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  
  return session.url;
}

// ============================================
// GET PUBLISHABLE KEY
// ============================================

export async function getPublishableKey(): Promise<string> {
  const modeConfig = await prisma.config.findUnique({
    where: { key: 'stripe_mode' },
  });
  
  const isTest = modeConfig?.value !== 'live';
  
  return isTest
    ? process.env.STRIPE_PUBLISHABLE_KEY_TEST || ''
    : process.env.STRIPE_PUBLISHABLE_KEY_LIVE || '';
}
