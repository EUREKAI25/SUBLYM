// SUBLYM Backend - Invitations Routes

import { Hono } from 'hono';
import { prisma } from '../db';
import { optionalAuthMiddleware, getOptionalAuthContext } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../middleware/error-handler';

const app = new Hono();

// ============================================
// GET /invitations/:code
// ============================================

app.get('/:code', async (c) => {
  const code = c.req.param('code').toUpperCase();
  
  const invitation = await prisma.invitation.findUnique({
    where: { code },
  });
  
  if (!invitation) {
    return c.json({
      valid: false,
      reason: 'not_found',
    });
  }
  
  if (!invitation.enabled) {
    return c.json({
      valid: false,
      reason: 'disabled',
    });
  }
  
  if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
    return c.json({
      valid: false,
      reason: 'expired',
    });
  }
  
  if (invitation.currentUses >= invitation.maxUses) {
    return c.json({
      valid: false,
      reason: 'limit_reached',
    });
  }
  
  return c.json({
    valid: true,
    freeGenerations: invitation.freeGenerations,
    expiresAt: invitation.expiresAt,
    usesRemaining: invitation.maxUses - invitation.currentUses,
  });
});

// ============================================
// POST /invitations/:code/view
// ============================================

app.post('/:code/view', async (c) => {
  const code = c.req.param('code').toUpperCase();
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
  const userAgent = c.req.header('user-agent');
  const referer = c.req.header('referer');
  
  const invitation = await prisma.invitation.findUnique({
    where: { code },
  });
  
  if (!invitation) {
    return c.json({ tracked: false });
  }
  
  // Check for duplicate view from same IP in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const existingView = await prisma.invitationView.findFirst({
    where: {
      invitationId: invitation.id,
      ip,
      viewedAt: { gte: oneHourAgo },
    },
  });
  
  if (!existingView) {
    // Create view record
    await prisma.invitationView.create({
      data: {
        invitationId: invitation.id,
        ip,
        userAgent,
        referer,
      },
    });
    
    // Increment view count
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { viewCount: { increment: 1 } },
    });
  }
  
  return c.json({ tracked: true });
});

// ============================================
// POST /invitations/:code/apply
// ============================================

app.post('/:code/apply', optionalAuthMiddleware, async (c) => {
  const code = c.req.param('code').toUpperCase();
  const auth = getOptionalAuthContext(c);
  
  // If user is logged in, we can apply directly
  if (!auth) {
    // User not logged in - they should register with this code
    return c.json({
      success: false,
      message: 'Please register with this invitation code',
      redirectTo: `/register?code=${code}`,
    });
  }
  
  const user = auth.user;
  
  // Check if user already used an invitation
  if (user.invitationId) {
    throw new ValidationError('You have already used an invitation code');
  }
  
  const invitation = await prisma.invitation.findUnique({
    where: { code },
  });
  
  if (!invitation) {
    throw new NotFoundError('Invitation');
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
  
  // Apply invitation to user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      invitationId: invitation.id,
      freeGenerations: { increment: invitation.freeGenerations },
    },
  });
  
  // Update invitation usage
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { currentUses: { increment: 1 } },
  });
  
  // Mark view as converted
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
  
  return c.json({
    success: true,
    message: `You received ${invitation.freeGenerations} free generation(s)!`,
    freeGenerations: invitation.freeGenerations,
  });
});

export { app as invitationsRoutes };
