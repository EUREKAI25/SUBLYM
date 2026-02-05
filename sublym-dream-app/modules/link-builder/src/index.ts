/**
 * EURKAI Link Builder Module
 *
 * Generates signed links and QR codes for access distribution.
 * Sources: Etsy, direct, partners, gifts, etc.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import crypto from 'crypto';

const app = new Hono();

app.use('*', cors());

const SIGNING_SECRET = process.env.SIGNING_SECRET || 'change-this-secret';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// ===========================================
// TYPES
// ===========================================

interface LinkParams {
  source: string;
  campaign?: string;
  medium?: string;
  expiresAt?: string;
  maxUses?: number;
  metadata?: Record<string, string>;
}

// ===========================================
// HELPERS
// ===========================================

function signParams(params: LinkParams): string {
  const data = JSON.stringify(params);
  const hmac = crypto.createHmac('sha256', SIGNING_SECRET);
  hmac.update(data);
  return hmac.digest('base64url');
}

function verifySignature(params: LinkParams, signature: string): boolean {
  const expectedSignature = signParams(params);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function encodeParams(params: LinkParams): string {
  return Buffer.from(JSON.stringify(params)).toString('base64url');
}

function decodeParams(encoded: string): LinkParams | null {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString());
  } catch {
    return null;
  }
}

// ===========================================
// ROUTES
// ===========================================

/**
 * POST /api/links
 * Create a new signed link
 */
app.post('/api/links', zValidator('json', z.object({
  source: z.string().min(1).max(50),
  campaign: z.string().max(100).optional(),
  medium: z.string().max(50).optional(),
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional(),
  metadata: z.record(z.string()).optional(),
})), async (c) => {
  const params = c.req.valid('json');

  const signature = signParams(params);
  const encoded = encodeParams(params);

  const url = `${APP_URL}/access?p=${encoded}&s=${signature}`;

  // Generate QR code
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
  });

  return c.json({
    url,
    shortUrl: `${APP_URL}/l/${nanoid(8)}`, // Would need a URL shortener service
    qrCode: qrDataUrl,
    params,
    signature,
    createdAt: new Date().toISOString(),
  });
});

/**
 * POST /api/links/verify
 * Verify a signed link
 */
app.post('/api/links/verify', zValidator('json', z.object({
  encoded: z.string(),
  signature: z.string(),
})), async (c) => {
  const { encoded, signature } = c.req.valid('json');

  const params = decodeParams(encoded);
  if (!params) {
    return c.json({ valid: false, error: 'Invalid encoding' }, 400);
  }

  const isValid = verifySignature(params, signature);

  if (!isValid) {
    return c.json({ valid: false, error: 'Invalid signature' }, 400);
  }

  // Check expiration
  if (params.expiresAt && new Date(params.expiresAt) < new Date()) {
    return c.json({ valid: false, error: 'Link expired' }, 400);
  }

  return c.json({
    valid: true,
    params,
  });
});

/**
 * POST /api/links/qr
 * Generate QR code for an existing URL
 */
app.post('/api/links/qr', zValidator('json', z.object({
  url: z.string().url(),
  size: z.number().int().min(128).max(2048).default(512),
  format: z.enum(['png', 'svg']).default('png'),
})), async (c) => {
  const { url, size, format } = c.req.valid('json');

  if (format === 'svg') {
    const svg = await QRCode.toString(url, { type: 'svg', width: size });
    return c.text(svg, 200, { 'Content-Type': 'image/svg+xml' });
  }

  const qrDataUrl = await QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
  });

  return c.json({ qrCode: qrDataUrl });
});

/**
 * GET /api/health
 */
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', module: 'link-builder' });
});

// ===========================================
// SERVER
// ===========================================

const port = parseInt(process.env.PORT || '3010', 10);

console.log(`
╔═══════════════════════════════════════════════════╗
║        EURKAI Link Builder Module                 ║
╚═══════════════════════════════════════════════════╝
`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🔗 Link Builder running on http://localhost:${info.port}`);
});

export default app;
