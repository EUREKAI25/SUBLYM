import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

import { authRoutes } from './routes/auth.js';
import { dreamRoutes } from './routes/dreams.js';
import { assetRoutes } from './routes/assets.js';
import { userRoutes } from './routes/users.js';
import { configRoutes } from './routes/config.js';
import { healthRoutes } from './routes/health.js';

const app = new Hono();

// Middleware globaux
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Routes
app.route('/api/health', healthRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/dreams', dreamRoutes);
app.route('/api/assets', assetRoutes);
app.route('/api/config', configRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  }, 500);
});

const port = parseInt(process.env.PORT || '3001', 10);

console.log(`
╔═══════════════════════════════════════════════════╗
║        SUBLYM Dream App - Backend API             ║
║        Mode: Images Only                          ║
╚═══════════════════════════════════════════════════╝
`);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`🚀 Server running on http://localhost:${info.port}`);
});

export default app;
