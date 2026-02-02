// SUBLYM Backend - Auth Routes

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { sign } from 'hono/jwt';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db';
import { authMiddleware, getAuthContext } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rate-limiter';
import { ValidationError, NotFoundError, ConflictError, UnauthorizedError } from '../middleware/error-handler';
import { sendMagicLink } from '../services/brevo';
import type { JWTPayload } from '../types';

const app = new Hono();

// ============================================
// SCHEMAS
// ============================================

const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  firstName: z.string().min(1, 'First name required').max(100),
  lastName: z.string().min(1, 'Last name required').max(100),
  birthDate: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  lang: z.string().length(2).default('fr'),
  invitationCode: z.string().optional(),
  rgpdConsent: z.boolean().refine((v) => v === true, 'RGPD consent required'),
  marketingConsent: z.boolean().optional().default(false),
});

const registerAndCheckoutSchema = z.object({
  email: z.string().email('Invalid email'),
  firstName: z.string().min(1, 'First name required').max(100),
  lastName: z.string().min(1, 'Last name required').max(100),
  birthDate: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  lang: z.string().length(2).default('fr'),
  rgpdConsent: z.boolean().refine((v) => v === true, 'RGPD consent required'),
  marketingConsent: z.boolean().optional().default(false),
  planLevel: z.number().int().min(1).max(3),
  billingPeriod: z.enum(['monthly', 'yearly']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const registerAndSmileSchema = z.object({
  email: z.string().email('Invalid email'),
  firstName: z.string().min(1, 'First name required').max(100),
  lastName: z.string().min(1, 'Last name required').max(100),
  birthDate: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  lang: z.string().length(2).default('fr'),
  rgpdConsent: z.boolean().refine((v) => v === true, 'RGPD consent required'),
  marketingConsent: z.boolean().optional().default(false),
  smileConsent: z.enum(['country_only', 'worldwide']),
});

const magicLinkSchema = z.object({
  email: z.string().email('Invalid email'),
  lang: z.string().length(2).optional(),
});

const verifySchema = z.object({
  token: z.string().uuid('Invalid token'),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// ============================================
// HELPERS
// ============================================

async function generateTokens(userId: number, email: string) {
  const jti = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  
  // Access token (7 days)
  const accessPayload: JWTPayload = {
    sub: userId,
    email,
    type: 'access',
    jti,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 days
  };
  
  const accessToken = await sign(accessPayload, process.env.JWT_SECRET!);
  
  // Refresh token (30 days)
  const refreshJti = uuidv4();
  const refreshPayload: JWTPayload = {
    sub: userId,
    email,
    type: 'refresh',
    jti: refreshJti,
    iat: now,
    exp: now + 30 * 24 * 60 * 60, // 30 days
  };
  
  const refreshToken = await sign(refreshPayload, process.env.JWT_SECRET!);
  
  return { accessToken, refreshToken, jti, refreshJti };
}

// ============================================
// ROUTES
// ============================================

// POST /auth/register
app.post('/register', authRateLimiter, zValidator('json', registerSchema), async (c) => {
  const data = c.req.valid('json');
  
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  
  if (existingUser) {
    throw new ConflictError('An account with this email already exists');
  }
  
  // Handle invitation code
  let invitation = null;
  let freeGenerations = 0;
  
  if (data.invitationCode) {
    invitation = await prisma.invitation.findUnique({
      where: { code: data.invitationCode.toUpperCase() },
    });
    
    if (!invitation) {
      throw new ValidationError('Invalid invitation code');
    }
    
    if (!invitation.enabled) {
      throw new ValidationError('This invitation code is no longer active');
    }
    
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      throw new ValidationError('This invitation code has expired');
    }
    
    if (invitation.currentUses >= invitation.maxUses) {
      throw new ValidationError('This invitation code has reached its usage limit');
    }
    
    freeGenerations = invitation.freeGenerations;
  }
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      gender: data.gender,
      lang: data.lang,
      freeGenerations,
      rgpdConsent: true,
      rgpdConsentAt: new Date(),
      marketingConsent: data.marketingConsent,
      invitationId: invitation?.id,
    },
  });
  
  // Update invitation usage
  if (invitation) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { currentUses: { increment: 1 } },
    });
    
    // Mark view as converted if exists
    await prisma.invitationView.updateMany({
      where: {
        invitationId: invitation.id,
        convertedToUser: false,
      },
      data: {
        convertedToUser: true,
        convertedUserId: user.id,
      },
    });
  }
  
  // Create and send magic link
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  
  const magicLink = await prisma.magicLink.create({
    data: {
      userId: user.id,
      expiresAt,
    },
  });
  
  // Send email
  await sendMagicLink(user.email, magicLink.token, user.lang);
  
  return c.json({
    success: true,
    message: 'Account created. Check your email for the magic link.',
  }, 201);
});

// ============================================
// POST /auth/register-and-checkout
// Pour les nouveaux utilisateurs qui choisissent un abonnement payant
// ============================================

app.post('/register-and-checkout', authRateLimiter, zValidator('json', registerAndCheckoutSchema), async (c) => {
  const data = c.req.valid('json');
  
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  
  if (existingUser) {
    throw new ConflictError('An account with this email already exists. Please login instead.');
  }
  
  const pricingLevel = await prisma.pricingLevel.findUnique({
    where: { level: data.planLevel },
  });
  
  if (!pricingLevel || !pricingLevel.enabled) {
    throw new ValidationError('Invalid subscription level');
  }
  
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      gender: data.gender,
      lang: data.lang,
      subscriptionLevel: 0,
      rgpdConsent: true,
      rgpdConsentAt: new Date(),
      marketingConsent: data.marketingConsent,
    },
  });
  
  const { createCheckoutSession } = await import('../services/stripe');
  
  const price = data.billingPeriod === 'yearly' 
    ? Number(pricingLevel.priceYearly) 
    : Number(pricingLevel.priceMonthly);
  
  const session = await createCheckoutSession(
    user.id,
    user.email,
    data.planLevel,
    data.billingPeriod,
    price,
    pricingLevel.name,
    data.successUrl,
    data.cancelUrl
  );
  
  const { accessToken, refreshToken } = await generateTokens(user.id, user.email);
  
  return c.json({
    success: true,
    checkoutUrl: session.url,
    sessionId: session.sessionId,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  }, 201);
});

// ============================================
// POST /auth/register-and-smile
// Pour les nouveaux utilisateurs qui choisissent l'option Smile (gratuit)
// ============================================

app.post('/register-and-smile', authRateLimiter, zValidator('json', registerAndSmileSchema), async (c) => {
  const data = c.req.valid('json');
  
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  
  if (existingUser) {
    throw new ConflictError('An account with this email already exists. Please login instead.');
  }
  
  const smileConfig = await prisma.smileConfig.findFirst({
    where: { 
      isActive: true,
      OR: [{ country: 'ALL' }],
    },
    orderBy: { country: 'desc' },
  });
  
  if (!smileConfig) {
    throw new ValidationError('Smile offer is not available at the moment');
  }
  
  if (smileConfig.currentCount >= smileConfig.threshold) {
    throw new ValidationError('Smile offer has reached its limit');
  }
  
  const subscriptionEnd = new Date();
  subscriptionEnd.setMonth(subscriptionEnd.getMonth() + smileConfig.premiumMonths);
  
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      gender: data.gender,
      lang: data.lang,
      subscriptionLevel: smileConfig.premiumLevel,
      subscriptionEnd,
      rgpdConsent: true,
      rgpdConsentAt: new Date(),
      marketingConsent: data.marketingConsent,
    },
  });
  
  await prisma.smileReaction.create({
    data: {
      userId: user.id,
      status: 'pending',
      // consentType retiré - pas dans le schema
      premiumLevel: smileConfig.premiumLevel,
    },
  });
  
  await prisma.smileConfig.update({
    where: { id: smileConfig.id },
    data: { currentCount: { increment: 1 } },
  });
  
  const { accessToken, refreshToken } = await generateTokens(user.id, user.email);
  
  return c.json({
    success: true,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      subscriptionLevel: user.subscriptionLevel,
      subscriptionEnd: user.subscriptionEnd,
    },
    smile: {
      premiumLevel: smileConfig.premiumLevel,
      premiumMonths: smileConfig.premiumMonths,
      // consentType retiré - pas dans le schema
    },
  }, 201);
});

// POST /auth/magic-link
app.post('/magic-link', authRateLimiter, zValidator('json', magicLinkSchema), async (c) => {
  const { email, lang } = c.req.valid('json');
  
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  
  if (!user) {
    // Don't reveal if user exists
    return c.json({
      success: true,
      message: 'If an account exists with this email, a magic link has been sent.',
    });
  }
  
  if (user.deletedAt) {
    return c.json({
      success: true,
      message: 'If an account exists with this email, a magic link has been sent.',
    });
  }
  
  // Check rate limit: 100 en dev, 6 en prod (anti-spam)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentLinks = await prisma.magicLink.count({
    where: {
      userId: user.id,
      createdAt: { gte: oneHourAgo },
    },
  });
  
  const maxMagicLinksPerHour = process.env.NODE_ENV === 'production' ? 6 : 100;
  if (recentLinks >= maxMagicLinksPerHour) {
    throw new ValidationError('Too many magic link requests. Please try again later.');
  }
  
  // Create magic link
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  
  const magicLink = await prisma.magicLink.create({
    data: {
      userId: user.id,
      expiresAt,
    },
  });
  
  // Update user lang if provided
  if (lang && lang !== user.lang) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lang },
    });
  }
  
  // Send email
  await sendMagicLink(user.email, magicLink.token, lang || user.lang);
  
  return c.json({
    success: true,
    message: 'If an account exists with this email, a magic link has been sent.',
  });
});

// POST /auth/verify
app.post('/verify', zValidator('json', verifySchema), async (c) => {
  const { token } = c.req.valid('json');
  
  const magicLink = await prisma.magicLink.findUnique({
    where: { token },
    include: { user: true },
  });
  
  if (!magicLink) {
    throw new NotFoundError('Magic link');
  }
  
  if (magicLink.usedAt) {
    throw new ValidationError('This magic link has already been used');
  }
  
  if (new Date(magicLink.expiresAt) < new Date()) {
    throw new ValidationError('This magic link has expired');
  }
  
  if (magicLink.user.deletedAt) {
    throw new UnauthorizedError('Account has been deleted');
  }
  
  // Mark magic link as used
  await prisma.magicLink.update({
    where: { id: magicLink.id },
    data: { usedAt: new Date() },
  });
  
  // Generate tokens
  const { accessToken, refreshToken } = await generateTokens(
    magicLink.user.id,
    magicLink.user.email
  );
  
  return c.json({
    success: true,
    accessToken,
    refreshToken,
    user: {
      id: magicLink.user.id,
      email: magicLink.user.email,
      firstName: magicLink.user.firstName,
      lastName: magicLink.user.lastName,
      subscriptionLevel: magicLink.user.subscriptionLevel,
      subscriptionEnd: magicLink.user.subscriptionEnd,
      freeGenerations: magicLink.user.freeGenerations,
      lang: magicLink.user.lang,
    },
  });
});

// POST /auth/refresh
app.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  
  try {
    const { verify } = await import('hono/jwt');
    const payload = await verify(refreshToken, process.env.JWT_SECRET!) as JWTPayload;
    
    if (payload.type !== 'refresh') {
      throw new UnauthorizedError('Invalid token type');
    }
    
    // Check if revoked
    const revoked = await prisma.revokedToken.findUnique({
      where: { jti: payload.jti },
    });
    
    if (revoked) {
      throw new UnauthorizedError('Token has been revoked');
    }
    
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });
    
    if (!user || user.deletedAt) {
      throw new UnauthorizedError('User not found');
    }
    
    // Revoke old refresh token
    await prisma.revokedToken.create({
      data: {
        jti: payload.jti,
        userId: user.id,
        reason: 'refresh',
        expiresAt: new Date(payload.exp * 1000),
      },
    });
    
    // Generate new tokens
    const tokens = await generateTokens(user.id, user.email);
    
    return c.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    throw new UnauthorizedError('Invalid refresh token');
  }
});

// GET /auth/me
app.get('/me', authMiddleware, async (c) => {
  const { user } = getAuthContext(c);
  
  // Get full user data with relations
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      photos: {
        orderBy: { order: 'asc' },
      },
      _count: {
        select: {
          dreams: true,
          testimonials: true,
        },
      },
    },
  });
  
  return c.json({
    success: true,
    user: {
      id: fullUser!.id,
      email: fullUser!.email,
      firstName: fullUser!.firstName,
      lastName: fullUser!.lastName,
      birthDate: fullUser!.birthDate,
      gender: fullUser!.gender,
      country: fullUser!.country,
      lang: fullUser!.lang,
      subscriptionLevel: fullUser!.subscriptionLevel,
      subscriptionEnd: fullUser!.subscriptionEnd,
      freeGenerations: fullUser!.freeGenerations,
      generationsUsedThisMonth: fullUser!.generationsUsedThisMonth,
      totalGenerations: fullUser!.totalGenerations,
      photos: fullUser!.photos.map((p) => ({
        id: p.id,
        path: p.path,
        verified: p.verified,
        order: p.order,
      })),
      photosCount: fullUser!.photos.length,
      dreamsCount: fullUser!._count.dreams,
      createdAt: fullUser!.createdAt,
    },
  });
});

// POST /auth/logout
app.post('/logout', authMiddleware, async (c) => {
  const { user, jti } = getAuthContext(c);
  
  // Revoke current token
  await prisma.revokedToken.create({
    data: {
      jti,
      userId: user.id,
      reason: 'logout',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
  
  return c.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// DELETE /auth/me (delete account)
app.delete('/me', authMiddleware, async (c) => {
  const { user, jti } = getAuthContext(c);
  
  // Soft delete user
  await prisma.user.update({
    where: { id: user.id },
    data: { deletedAt: new Date() },
  });
  
  // Revoke current token
  await prisma.revokedToken.create({
    data: {
      jti,
      userId: user.id,
      reason: 'account_deleted',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  
  return c.json({
    success: true,
    message: 'Account scheduled for deletion. You have 30 days to recover it.',
  });
});

export { app as authRoutes };
