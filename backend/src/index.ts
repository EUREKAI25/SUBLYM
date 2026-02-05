// SUBLYM Backend - Main Server
// Version 1.0 - 27 janvier 2026

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { rateLimiter } from 'hono-rate-limiter';
import { serveStatic } from '@hono/node-server/serve-static';

// Routes
import { authRoutes } from './routes/auth';
import { configRoutes } from './routes/config';
import { photosRoutes } from './routes/photos';
import { dreamsRoutes } from './routes/dreams';
import { runsRoutes } from './routes/runs';
import { paymentRoutes } from './routes/payment';
import { subscriptionRoutes } from './routes/subscription';
import { smileRoutes } from './routes/smile';
import { testimonialsRoutes } from './routes/testimonials';
import { invitationsRoutes } from './routes/invitations';
import { contactRoutes } from './routes/contact';
import { legalRoutes } from './routes/legal';
import { adminRoutes } from './routes/admin';
import { testRoutes } from './routes/test';

// Middleware
import { errorHandler } from './middleware/error-handler';

// Types
import type { Context } from 'hono';

// ============================================
// APP SETUP
// ============================================

const app = new Hono();

// ============================================
// GLOBAL MIDDLEWARE
// ============================================

// Secure headers
app.use('*', secureHeaders());

// Logger
app.use('*', logger());

// CORS
const allowedOrigins = [
  'https://sublym.org',
  'https://www.sublym.org',
  'https://admin.sublym.org',
  'http://212.227.80.241',
  'https://preprod.sublym.org',
  'http://preprod.sublym.org',
];

if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:5173', 'http://localhost:5174', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178', 'http://localhost:5179');
}

app.use('*', cors({
  origin: allowedOrigins,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  exposeHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400,
}));

// Global rate limiter (100 req/min/IP)
app.use('*', rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  standardHeaders: true,
  keyGenerator: (c: Context) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
}));

// ============================================
// HEALTH CHECK
// ============================================

app.get('/', (c) => {
  return c.json({
    name: 'SUBLYM API',
    version: '1.0.0',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// ============================================
// STATIC FILE SERVING
// ============================================

// Static file serving for storage (photos, videos, etc.)
app.use('/storage/*', serveStatic({ root: './' }));

// ============================================
// API ROUTES
// ============================================

const api = new Hono();

// Public routes
api.route('/auth', authRoutes);
api.route('/config', configRoutes);
api.route('/testimonials', testimonialsRoutes);
api.route('/invitations', invitationsRoutes);
api.route('/contact', contactRoutes);
api.route('/legal', legalRoutes);

// Protected routes (require auth)
api.route('/photos', photosRoutes);
api.route('/dreams', dreamsRoutes);
api.route('/runs', runsRoutes);
api.route('/payment', paymentRoutes);
api.route('/subscription', subscriptionRoutes);
api.route('/smile', smileRoutes);

// Admin routes
api.route('/admin', adminRoutes);

// Test routes (dev/admin only)
api.route('/test', testRoutes);

// Mount API
app.route('/api/v1', api);

// ============================================
// ERROR HANDLING
// ============================================

app.onError(errorHandler);

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'NOT_FOUND',
    message: 'Route not found',
  }, 404);
});

// ============================================
// EXPORT
// ============================================

export { app };

// ============================================
// START SERVER
// ============================================
import { serve } from '@hono/node-server';

const port = parseInt(process.env.PORT || '8000');

console.log(`🚀 SUBLYM API starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`✅ Server running at http://localhost:${info.port}`);
});
