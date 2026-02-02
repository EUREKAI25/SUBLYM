// SUBLYM Backend - Rate Limiter Middleware
// Custom rate limiters for specific endpoints

import { Context, Next } from 'hono';
import { prisma } from '../db';
import { RateLimitError } from './error-handler';
import { getAuthContext, getOptionalAuthContext } from './auth';

// In-memory store (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// ============================================
// GENERIC RATE LIMITER
// ============================================

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (c: Context) => string;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyGenerator = (c: Context) => c.req.header('x-forwarded-for') || 'unknown',
    message = 'Too many requests, please try again later',
  } = options;

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, record);
    }
    
    record.count++;
    
    // Set headers
    c.header('X-RateLimit-Limit', max.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, max - record.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000).toString());
    
    if (record.count > max) {
      throw new RateLimitError(message);
    }
    
    await next();
  };
}

// ============================================
// SPECIFIC RATE LIMITERS
// ============================================

// Magic link: 3 requests per hour per email
export const magicLinkRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator: async (c: Context) => {
    const body = await c.req.json().catch(() => ({}));
    return `magic_link:${body.email || 'unknown'}`;
  },
  message: 'Too many magic link requests. Please try again in 1 hour.',
});

// Upload: 10 requests per minute per user
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (c: Context) => {
    const auth = getOptionalAuthContext(c);
    return `upload:${auth?.user.id || c.req.header('x-forwarded-for') || 'unknown'}`;
  },
  message: 'Too many upload requests. Please wait a moment.',
});

// Generate: 10 requests per minute per user
export const generateRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (c: Context) => {
    const auth = getOptionalAuthContext(c);
    return `generate:${auth?.user.id || c.req.header('x-forwarded-for') || 'unknown'}`;
  },
  message: 'Too many generation requests. Please wait a moment.',
});

// Auth endpoints: 20 requests per minute per IP
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  keyGenerator: (c: Context) => {
    return `auth:${c.req.header('x-forwarded-for') || 'unknown'}`;
  },
  message: 'Too many authentication requests.',
});

// ============================================
// CLEANUP (run periodically)
// ============================================

export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
