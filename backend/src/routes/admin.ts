// SUBLYM Backend - Admin Routes

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { sign } from 'hono/jwt';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs/promises';
import * as path from 'path';
import { prisma } from '../db';
import { adminMiddleware, superadminMiddleware, getAdminContext } from '../middleware/auth';
import { ValidationError, NotFoundError, UnauthorizedError } from '../middleware/error-handler';
import { sendInvitationEmail, sendInvitationSMS } from '../services/brevo';
import { startGeneration } from '../services/generation';
import type { AdminJWTPayload } from '../types';

const app = new Hono();

// ============================================
// AUTH (Public)
// ============================================

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

app.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  
  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  
  if (!admin) {
    throw new UnauthorizedError('Invalid credentials');
  }
  
  const validPassword = await bcrypt.compare(password, admin.passwordHash);
  if (!validPassword) {
    throw new UnauthorizedError('Invalid credentials');
  }
  
  // Update last login
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });
  
  // Generate token
  const jti = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  
  const payload: AdminJWTPayload = {
    sub: admin.id,
    email: admin.email,
    role: admin.role as 'admin' | 'superadmin',
    type: 'admin_access',
    jti,
    iat: now,
    exp: now + 24 * 60 * 60, // 24 hours
  };
  
  const token = await sign(payload, process.env.JWT_SECRET!);
  
  return c.json({
    success: true,
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
    },
  });
});

// ============================================
// PROTECTED ROUTES
// ============================================

app.use('/*', adminMiddleware);

// ============================================
// DASHBOARD
// ============================================

app.get('/dashboard', async (c) => {
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(now.setDate(now.getDate() - 7));
  const monthStart = new Date(now.setMonth(now.getMonth() - 1));
  
  const [
    usersTotal,
    usersToday,
    dreamsTotal,
    runsCompleted,
    paymentsTotal,
    paymentsToday,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.dream.count(),
    prisma.run.count({ where: { status: 'completed' } }),
    prisma.payment.aggregate({
      where: { status: 'succeeded' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'succeeded', createdAt: { gte: todayStart } },
      _sum: { amount: true },
    }),
  ]);
  
  return c.json({
    users: { total: usersTotal, today: usersToday },
    dreams: { total: dreamsTotal },
    runs: { completed: runsCompleted },
    revenue: {
      total: (paymentsTotal._sum.amount || 0) / 100,
      today: (paymentsToday._sum.amount || 0) / 100,
    },
  });
});

// ============================================
// USERS
// ============================================

app.get('/users', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '20');
  const email = c.req.query('email');
  const subscriptionLevel = c.req.query('subscriptionLevel');
  const deleted = c.req.query('deleted') === 'true';
  
  const where: any = {};
  if (email) where.email = { contains: email, mode: 'insensitive' };
  if (subscriptionLevel) where.subscriptionLevel = parseInt(subscriptionLevel);
  if (deleted) where.deletedAt = { not: null };
  else where.deletedAt = null;
  
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        _count: { select: { dreams: true, photos: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  
  return c.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      subscriptionLevel: u.subscriptionLevel,
      subscriptionEnd: u.subscriptionEnd,
      freeGenerations: u.freeGenerations,
      totalGenerations: u.totalGenerations,
      isTestAccount: u.isTestAccount,
      dreamsCount: u._count.dreams,
      photosCount: u._count.photos,
      createdAt: u.createdAt,
      deletedAt: u.deletedAt,
    })),
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });
});

app.get('/users/:id', async (c) => {
  const userId = parseInt(c.req.param('id'));
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      photos: true,
      dreams: { include: { runs: true } },
      testimonials: true,
      invitation: true,
    },
  });
  
  if (!user) throw new NotFoundError('User');
  
  return c.json({ user });
});

const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  subscriptionLevel: z.number().optional(),
  freeGenerations: z.number().optional(),
  isTestAccount: z.boolean().optional(),
});

app.put('/users/:id', zValidator('json', updateUserSchema), async (c) => {
  const { admin } = getAdminContext(c);
  const userId = parseInt(c.req.param('id'));
  const data = c.req.valid('json');
  
  const oldUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!oldUser) throw new NotFoundError('User');
  
  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });
  
  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'USER_UPDATE',
      target: `user:${userId}`,
      details: { old: oldUser, new: user },
    },
  });
  
  return c.json({ success: true, user });
});

app.delete('/users/:id', async (c) => {
  const { admin } = getAdminContext(c);
  const userId = parseInt(c.req.param('id'));
  
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
  
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'USER_DELETE',
      target: `user:${userId}`,
    },
  });
  
  return c.json({ success: true, message: 'User deleted' });
});

// ============================================
// CONFIG
// ============================================

app.get('/config', async (c) => {
  const configs = await prisma.config.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  });
  
  return c.json({ configs });
});

app.put('/config', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const body = await c.req.json();
  const { configs } = body;
  
  for (const { key, value } of configs) {
    await prisma.config.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'CONFIG_UPDATE',
      details: { configs },
    },
  });
  
  return c.json({ success: true });
});

// ============================================
// TEXTS
// ============================================

app.get('/texts', async (c) => {
  const lang = c.req.query('lang');
  const where = lang ? { lang } : {};
  
  const texts = await prisma.text.findMany({
    where,
    orderBy: [{ lang: 'asc' }, { key: 'asc' }],
  });
  
  return c.json({ texts });
});

app.put('/texts', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const body = await c.req.json();
  const { texts } = body;
  
  for (const { lang, key, value } of texts) {
    await prisma.text.upsert({
      where: { lang_key: { lang, key } },
      update: { value },
      create: { lang, key, value },
    });
  }
  
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'TEXT_UPDATE',
      details: { count: texts.length },
    },
  });
  
  return c.json({ success: true });
});

// ============================================
// TESTIMONIALS
// ============================================

app.get('/testimonials', async (c) => {
  const status = c.req.query('status');
  const where = status ? { status } : {};
  
  const testimonials = await prisma.testimonial.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
  
  return c.json({ testimonials });
});

app.put('/testimonials/:id/approve', async (c) => {
  const { admin } = getAdminContext(c);
  const id = parseInt(c.req.param('id'));
  
  await prisma.testimonial.update({
    where: { id },
    data: { status: 'approved', approvedAt: new Date(), approvedBy: admin.id },
  });
  
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'TESTIMONIAL_APPROVE',
      target: `testimonial:${id}`,
    },
  });
  
  return c.json({ success: true });
});

app.put('/testimonials/:id/reject', async (c) => {
  const { admin } = getAdminContext(c);
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  
  await prisma.testimonial.update({
    where: { id },
    data: { status: 'rejected', rejectionReason: body.reason },
  });
  
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'TESTIMONIAL_REJECT',
      target: `testimonial:${id}`,
    },
  });
  
  return c.json({ success: true });
});

// ============================================
// INVITATIONS
// ============================================

app.get('/invitations', async (c) => {
  const invitations = await prisma.invitation.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      users: { select: { id: true, email: true, firstName: true, createdAt: true } },
      _count: { select: { views: true } },
    },
  });
  
  return c.json({
    invitations: invitations.map((i) => ({
      ...i,
      viewCount: i._count.views,
      conversionRate: i._count.views > 0 ? (i.currentUses / i._count.views) * 100 : 0,
    })),
  });
});

const createInvitationSchema = z.object({
  description: z.string().optional(),
  maxUses: z.number().int().min(1).default(1),
  freeGenerations: z.number().int().min(1).default(1),
  expiresInDays: z.number().int().min(1).optional(),
  targetEmail: z.string().email().optional(),
  targetPhone: z.string().optional(),
});

app.post('/invitations', zValidator('json', createInvitationSchema), async (c) => {
  const { admin } = getAdminContext(c);
  const data = c.req.valid('json');
  
  // Generate unique code
  const code = uuidv4().substring(0, 8).toUpperCase();
  
  const expiresAt = data.expiresInDays
    ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  
  const invitation = await prisma.invitation.create({
    data: {
      code,
      description: data.description,
      maxUses: data.maxUses,
      freeGenerations: data.freeGenerations,
      expiresAt,
      targetEmail: data.targetEmail,
      targetPhone: data.targetPhone,
      createdBy: admin.id,
    },
  });

  // Create Contact record if targetEmail or targetPhone provided
  if (data.targetEmail || data.targetPhone) {
    await prisma.contact.create({
      data: {
        email: data.targetEmail,
        phone: data.targetPhone,
        invitationId: invitation.id,
        source: 'manual',
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'INVITATION_CREATE',
      target: `invitation:${invitation.id}`,
      details: { code },
    },
  });

  return c.json({
    success: true,
    invitation,
    link: `${process.env.APP_URL}/invite/${code}`,
  });
});

const sendInvitationSchema = z.object({
  method: z.enum(['email', 'sms']).default('email'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  message: z.string().max(500).optional(),
  lang: z.enum(['fr', 'en', 'it']).optional(),
});

app.post('/invitations/:id/send', zValidator('json', sendInvitationSchema), async (c) => {
  const { admin } = getAdminContext(c);
  const invitationId = parseInt(c.req.param('id'));
  const data = c.req.valid('json');

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new NotFoundError('Invitation');
  }

  let sent = false;
  const method = data.method || 'email';

  if (method === 'sms') {
    if (!data.phone) {
      throw new ValidationError('Phone number is required for SMS');
    }
    sent = await sendInvitationSMS(
      data.phone,
      invitation.code,
      invitation.freeGenerations,
      data.message || '',
      data.lang || 'fr'
    );
    if (sent) {
      await prisma.invitation.update({
        where: { id: invitationId },
        data: {
          targetPhone: data.phone,
          sentAt: new Date(),
          sentVia: 'sms',
        },
      });
      // Upsert Contact for tracking
      const existing = await prisma.contact.findFirst({
        where: { invitationId, phone: data.phone },
      });
      if (!existing) {
        await prisma.contact.create({
          data: {
            phone: data.phone,
            invitationId,
            source: 'sms',
          },
        });
      }
    }
  } else {
    if (!data.email) {
      throw new ValidationError('Email is required');
    }
    sent = await sendInvitationEmail(
      data.email,
      invitation.code,
      invitation.freeGenerations,
      data.message || '',
      data.lang || 'fr'
    );
    if (sent) {
      await prisma.invitation.update({
        where: { id: invitationId },
        data: {
          targetEmail: data.email,
          sentAt: new Date(),
          sentVia: 'email',
        },
      });
      // Upsert Contact for tracking
      const existing = await prisma.contact.findFirst({
        where: { invitationId, email: data.email },
      });
      if (!existing) {
        await prisma.contact.create({
          data: {
            email: data.email,
            invitationId,
            source: 'email',
          },
        });
      }
    }
  }

  if (sent) {
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'INVITATION_SEND',
        target: `invitation:${invitationId}`,
        details: { recipient: data.email || data.phone, method },
      },
    });
  }

  return c.json({
    success: sent,
    message: sent ? 'Invitation envoyée' : 'Échec de l\'envoi',
  });
});

// ============================================
// CONTACTS (Conversion tracking)
// ============================================

app.get('/contacts', async (c) => {
  const contacts = await prisma.contact.findMany({
    include: {
      invitation: {
        select: { code: true, description: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const total = contacts.length;
  const converted = contacts.filter(c => c.convertedAt !== null).length;
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  return c.json({
    contacts,
    stats: { total, converted, pending: total - converted, conversionRate },
  });
});

// ============================================
// FINANCES
// ============================================

app.get('/finances/summary', async (c) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const [today, week, month, subscriptions] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: 'succeeded', createdAt: { gte: todayStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: 'succeeded', createdAt: { gte: weekStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: 'succeeded', createdAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.user.groupBy({
      by: ['subscriptionLevel'],
      where: { subscriptionLevel: { gt: 0 }, deletedAt: null },
      _count: true,
    }),
  ]);
  
  return c.json({
    today: { revenue: (today._sum.amount || 0) / 100, count: today._count },
    thisWeek: { revenue: (week._sum.amount || 0) / 100, count: week._count },
    thisMonth: { revenue: (month._sum.amount || 0) / 100, count: month._count },
    subscriptions: {
      byLevel: subscriptions.reduce((acc, s) => {
        acc[s.subscriptionLevel] = s._count;
        return acc;
      }, {} as Record<number, number>),
    },
  });
});

app.get('/finances/payments', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '50');
  const status = c.req.query('status');
  
  const where = status ? { status } : {};
  
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.payment.count({ where }),
  ]);
  
  return c.json({
    payments: payments.map((p) => ({
      ...p,
      amount: p.amount / 100,
    })),
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });
});

// ============================================
// AUDIT LOG
// ============================================

app.get('/audit-log', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '50');
  const action = c.req.query('action');
  
  const where = action ? { action } : {};
  
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        admin: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  
  return c.json({
    logs,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });
});

// ============================================
// SMILE REACTIONS
// ============================================

app.get('/smile-reactions', async (c) => {
  const status = c.req.query('status');
  const where: Record<string, unknown> = {};
  if (status && status !== 'all') {
    where.status = status;
  }

  const reactions = await prisma.smileReaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  return c.json({ reactions });
});

app.get('/smile-configs', async (c) => {
  const configs = await prisma.smileConfig.findMany({
    orderBy: { country: 'asc' },
  });

  return c.json({ configs });
});

app.put('/smile-reactions/:id/revoke', async (c) => {
  const { admin } = getAdminContext(c);
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));

  const reaction = await prisma.smileReaction.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!reaction) throw new NotFoundError('SmileReaction');

  // Revoke premium if it was granted
  if (reaction.premiumGranted && reaction.user) {
    await prisma.user.update({
      where: { id: reaction.userId },
      data: {
        subscriptionLevel: 0,
        subscriptionEnd: null,
      },
    });
  }

  await prisma.smileReaction.update({
    where: { id },
    data: {
      status: 'rejected',
      premiumGranted: false,
      premiumUntil: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'SMILE_REVOKE',
      target: `smile:${id}`,
      details: { reason: (body as Record<string, unknown>).reason || null },
    },
  });

  return c.json({ success: true });
});

// ============================================
// GENERATE PUB (Admin-triggered pub generation)
// ============================================

const generatePubSchema = z.object({
  dreamDescription: z.string().min(10),
  dailyContext: z.string().min(5),
  userId: z.number().int(),
  scenesCount: z.number().int().min(3).max(10).default(7),
  reject: z.array(z.string()).optional(),
});

app.post('/generate-pub', superadminMiddleware, zValidator('json', generatePubSchema), async (c) => {
  const { admin } = getAdminContext(c);
  const data = c.req.valid('json');

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    include: { photos: true },
  });

  if (!user) throw new NotFoundError('User');

  if (!user.photos.length) {
    throw new ValidationError('User has no photos uploaded');
  }

  // Create dream entry
  const dream = await prisma.dream.create({
    data: {
      userId: user.id,
      description: data.dreamDescription,
      reject: data.reject || [],
      status: 'processing',
    },
  });

  // Create run entry
  const run = await prisma.run.create({
    data: {
      dreamId: dream.id,
      status: 'pending',
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'GENERATE_PUB',
      target: `dream:${dream.id}`,
      details: {
        userId: user.id,
        dailyContext: data.dailyContext,
        scenesCount: data.scenesCount,
      },
    },
  });

  // Start generation in background with scenario_pub mode
  startGeneration(dream.id, user.id, run.traceId, {
    description: data.dreamDescription,
    reject: data.reject || [],
    photoPaths: user.photos.map((p) => p.path),
    isPhotosOnly: false,
    scenesCount: data.scenesCount,
    keyframesCount: data.scenesCount,
    characterName: user.firstName || 'User',
    characterGender: user.gender || 'neutral',
    mode: 'scenario_pub',
    dailyContext: data.dailyContext,
  });

  return c.json({
    success: true,
    dream: { id: dream.id },
    run: { id: run.id, traceId: run.traceId },
  });
});

// ============================================
// LEGAL DOCUMENTS
// ============================================

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

// GET /admin/legal-documents - List all
app.get('/legal-documents', adminMiddleware, async (c) => {
  const type = c.req.query('type');
  const where = type ? { type } : {};

  const documents = await prisma.legalDocument.findMany({
    where,
    orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
  });

  return c.json({ documents });
});

// POST /admin/legal-documents - Upload new document
app.post('/legal-documents', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);

  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const type = formData.get('type') as string;
  const version = formData.get('version') as string;
  const notes = (formData.get('notes') as string) || null;

  if (!file || !type || !version) {
    throw new ValidationError('File, type, and version are required');
  }

  const validTypes = ['terms', 'privacy', 'legal_notices', 'cookies'];
  if (!validTypes.includes(type)) {
    throw new ValidationError(`Invalid document type. Allowed: ${validTypes.join(', ')}`);
  }

  if (file.type !== 'application/pdf') {
    throw new ValidationError('Only PDF files are allowed');
  }

  // Save file
  const legalDir = path.join(STORAGE_PATH, 'legal');
  await fs.mkdir(legalDir, { recursive: true });

  const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${type}_v${safeVersion}_${Date.now()}.pdf`;
  const filepath = `legal/${filename}`;
  const fullPath = path.join(STORAGE_PATH, filepath);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);

  // Deactivate previous active of same type
  await prisma.legalDocument.updateMany({
    where: { type, isActive: true },
    data: { isActive: false },
  });

  // Create new document record (active by default)
  const document = await prisma.legalDocument.create({
    data: {
      type,
      version,
      filename: file.name,
      filepath,
      filesize: buffer.length,
      mimeType: file.type,
      isActive: true,
      uploadedBy: admin.id,
      notes,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'LEGAL_DOCUMENT_UPLOAD',
      target: `legal:${document.id}`,
      details: { type, version, filename: file.name },
    },
  });

  return c.json({ success: true, document }, 201);
});

// PUT /admin/legal-documents/:id/activate - Set version as active
app.put('/legal-documents/:id/activate', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const id = parseInt(c.req.param('id'));

  const doc = await prisma.legalDocument.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError('Legal document');

  // Deactivate others of same type
  await prisma.legalDocument.updateMany({
    where: { type: doc.type, isActive: true },
    data: { isActive: false },
  });

  // Activate this one
  await prisma.legalDocument.update({
    where: { id },
    data: { isActive: true },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'LEGAL_DOCUMENT_ACTIVATE',
      target: `legal:${id}`,
      details: { type: doc.type, version: doc.version },
    },
  });

  return c.json({ success: true });
});

// DELETE /admin/legal-documents/:id - Delete (non-active only)
app.delete('/legal-documents/:id', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const id = parseInt(c.req.param('id'));

  const doc = await prisma.legalDocument.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError('Legal document');

  if (doc.isActive) {
    throw new ValidationError('Cannot delete the active version. Activate another version first.');
  }

  // Delete file
  try {
    await fs.unlink(path.join(STORAGE_PATH, doc.filepath));
  } catch (err) {
    console.error('Failed to delete legal document file:', err);
  }

  await prisma.legalDocument.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'LEGAL_DOCUMENT_DELETE',
      target: `legal:${id}`,
      details: { type: doc.type, version: doc.version },
    },
  });

  return c.json({ success: true });
});

export { app as adminRoutes };
