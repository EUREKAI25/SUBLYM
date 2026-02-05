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
import sharp from 'sharp';
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
  lang: z.enum(['fr', 'en', 'de', 'es', 'it']).optional(),
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

// GET /admin/finances/costs - Cost tracking from Run.costEur
app.get('/finances/costs', async (c) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [costsToday, costsWeek, costsMonth, costsYear] = await Promise.all([
    prisma.run.aggregate({
      where: { createdAt: { gte: todayStart }, costEur: { not: null } },
      _sum: { costEur: true },
      _count: true,
    }),
    prisma.run.aggregate({
      where: { createdAt: { gte: weekStart }, costEur: { not: null } },
      _sum: { costEur: true },
      _count: true,
    }),
    prisma.run.aggregate({
      where: { createdAt: { gte: monthStart }, costEur: { not: null } },
      _sum: { costEur: true },
      _count: true,
    }),
    prisma.run.aggregate({
      where: { createdAt: { gte: yearStart }, costEur: { not: null } },
      _sum: { costEur: true },
      _count: true,
    }),
  ]);

  // Get cost breakdown by provider/type from costDetails JSON
  // Fetch recent runs with costDetails to aggregate by provider
  const runsWithCostDetails = await prisma.run.findMany({
    where: { costEur: { not: null }, costDetails: { not: undefined } },
    select: { costDetails: true, costEur: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  // Aggregate costDetails by provider/category
  const providerBreakdown: Record<string, { totalCost: number; count: number }> = {};
  for (const run of runsWithCostDetails) {
    if (run.costDetails && typeof run.costDetails === 'object') {
      const details = run.costDetails as Record<string, any>;
      for (const [key, value] of Object.entries(details)) {
        if (!providerBreakdown[key]) {
          providerBreakdown[key] = { totalCost: 0, count: 0 };
        }
        providerBreakdown[key].count += 1;
        if (typeof value === 'number') {
          providerBreakdown[key].totalCost += value;
        } else if (typeof value === 'object' && value !== null && typeof value.cost === 'number') {
          providerBreakdown[key].totalCost += value.cost;
        }
      }
    }
  }

  // Round breakdown values
  for (const key of Object.keys(providerBreakdown)) {
    providerBreakdown[key].totalCost = Math.round(providerBreakdown[key].totalCost * 10000) / 10000;
  }

  return c.json({
    today: {
      cost: Number(costsToday._sum.costEur || 0),
      generations: costsToday._count,
    },
    thisWeek: {
      cost: Number(costsWeek._sum.costEur || 0),
      generations: costsWeek._count,
    },
    thisMonth: {
      cost: Number(costsMonth._sum.costEur || 0),
      generations: costsMonth._count,
    },
    thisYear: {
      cost: Number(costsYear._sum.costEur || 0),
      generations: costsYear._count,
    },
    providerBreakdown,
  });
});

// GET /admin/finances/overview - Full P&L view
app.get('/finances/overview', async (c) => {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // Revenue and costs for current periods
  const [revenueWeek, revenueMonth, revenueYear, costsWeek, costsMonth, costsYear] = await Promise.all([
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
    prisma.payment.aggregate({
      where: { status: 'succeeded', createdAt: { gte: yearStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.run.aggregate({
      where: { createdAt: { gte: weekStart }, costEur: { not: null } },
      _sum: { costEur: true },
      _count: true,
    }),
    prisma.run.aggregate({
      where: { createdAt: { gte: monthStart }, costEur: { not: null } },
      _sum: { costEur: true },
      _count: true,
    }),
    prisma.run.aggregate({
      where: { createdAt: { gte: yearStart }, costEur: { not: null } },
      _sum: { costEur: true },
      _count: true,
    }),
  ]);

  const revWeek = (revenueWeek._sum.amount || 0) / 100;
  const revMonth = (revenueMonth._sum.amount || 0) / 100;
  const revYear = (revenueYear._sum.amount || 0) / 100;
  const costWeek = Number(costsWeek._sum.costEur || 0);
  const costMonth = Number(costsMonth._sum.costEur || 0);
  const costYear = Number(costsYear._sum.costEur || 0);

  // Monthly breakdown for the last 12 months
  const monthlyBreakdown: Array<{
    month: string;
    revenue: number;
    costs: number;
    margin: number;
    generationCount: number;
    paymentCount: number;
  }> = [];

  for (let i = 11; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthLabel = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, '0')}`;

    const [mRevenue, mCosts] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'succeeded', createdAt: { gte: mStart, lt: mEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.run.aggregate({
        where: { createdAt: { gte: mStart, lt: mEnd }, costEur: { not: null } },
        _sum: { costEur: true },
        _count: true,
      }),
    ]);

    const rev = (mRevenue._sum.amount || 0) / 100;
    const cost = Number(mCosts._sum.costEur || 0);

    monthlyBreakdown.push({
      month: monthLabel,
      revenue: Math.round(rev * 100) / 100,
      costs: Math.round(cost * 10000) / 10000,
      margin: Math.round((rev - cost) * 100) / 100,
      generationCount: mCosts._count,
      paymentCount: mRevenue._count,
    });
  }

  // Forecast: simple linear projection for next 3 months based on last 6 months trend
  const recentMonths = monthlyBreakdown.slice(-6);
  let forecastRevSlope = 0;
  let forecastCostSlope = 0;

  if (recentMonths.length >= 2) {
    // Simple linear regression on revenue and costs
    const n = recentMonths.length;
    let sumX = 0, sumRevY = 0, sumCostY = 0, sumXRevY = 0, sumXCostY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumRevY += recentMonths[i].revenue;
      sumCostY += recentMonths[i].costs;
      sumXRevY += i * recentMonths[i].revenue;
      sumXCostY += i * recentMonths[i].costs;
      sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    if (denom !== 0) {
      forecastRevSlope = (n * sumXRevY - sumX * sumRevY) / denom;
      forecastCostSlope = (n * sumXCostY - sumX * sumCostY) / denom;
    }
  }

  const lastRevenue = recentMonths.length > 0 ? recentMonths[recentMonths.length - 1].revenue : 0;
  const lastCosts = recentMonths.length > 0 ? recentMonths[recentMonths.length - 1].costs : 0;

  const forecast: Array<{ month: string; revenue: number; costs: number; margin: number }> = [];
  for (let i = 1; i <= 3; i++) {
    const fDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const fLabel = `${fDate.getFullYear()}-${String(fDate.getMonth() + 1).padStart(2, '0')}`;
    const fRev = Math.max(0, Math.round((lastRevenue + forecastRevSlope * i) * 100) / 100);
    const fCost = Math.max(0, Math.round((lastCosts + forecastCostSlope * i) * 10000) / 10000);
    forecast.push({
      month: fLabel,
      revenue: fRev,
      costs: fCost,
      margin: Math.round((fRev - fCost) * 100) / 100,
    });
  }

  return c.json({
    summary: {
      week: { revenue: revWeek, costs: costWeek, margin: Math.round((revWeek - costWeek) * 100) / 100 },
      month: { revenue: revMonth, costs: costMonth, margin: Math.round((revMonth - costMonth) * 100) / 100 },
      year: { revenue: revYear, costs: costYear, margin: Math.round((revYear - costYear) * 100) / 100 },
    },
    monthlyBreakdown,
    forecast,
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
// ADMIN PHOTO UPLOAD (for a specific user)
// ============================================

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

app.post('/users/:id/photos', superadminMiddleware, async (c) => {
  const userId = parseInt(c.req.param('id'));
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');

  const formData = await c.req.formData();
  const files = formData.getAll('photos') as File[];

  if (files.length === 0) {
    throw new ValidationError('No photos provided');
  }

  // Delete existing photos for this user (replace all)
  const existingPhotos = await prisma.photo.findMany({ where: { userId } });
  for (const photo of existingPhotos) {
    const filePath = path.join(STORAGE_PATH, photo.path);
    await fs.unlink(filePath).catch(() => {});
  }
  await prisma.photo.deleteMany({ where: { userId } });

  // Process and save new photos
  const photoDir = path.join(STORAGE_PATH, 'users', userId.toString(), 'photos');
  await fs.mkdir(photoDir, { recursive: true });

  const uploadedPhotos = [];
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!allowedTypes.includes(file.type)) continue;

    const buffer = Buffer.from(await file.arrayBuffer());
    let image = sharp(buffer);
    const metadata = await image.metadata();
    if (metadata.width && metadata.width > 1024) {
      image = image.resize(1024, null, { withoutEnlargement: true });
    } else if (metadata.height && metadata.height > 1024) {
      image = image.resize(null, 1024, { withoutEnlargement: true });
    }
    const processed = await image.jpeg({ quality: 85 }).toBuffer();

    const filename = `${uuidv4()}.jpg`;
    const filePath = path.join(photoDir, filename);
    const relativePath = `users/${userId}/photos/${filename}`;

    await fs.writeFile(filePath, processed);

    const photo = await prisma.photo.create({
      data: {
        userId,
        filename,
        path: relativePath,
        originalName: file.name,
        mimeType: 'image/jpeg',
        size: processed.length,
        order: i,
        verified: true, // Admin-uploaded = auto-verified
      },
    });

    uploadedPhotos.push({ id: photo.id, path: relativePath, order: i });
  }

  return c.json({
    success: true,
    photos: uploadedPhotos,
    total: uploadedPhotos.length,
  }, 201);
});

// ============================================
// GENERATE PUB (Admin-triggered pub generation)
// ============================================

app.post('/generate-pub', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const formData = await c.req.formData();

  const dreamDescription = formData.get('dreamDescription') as string;
  const dailyContext = (formData.get('dailyContext') as string) || '';
  const scenesCount = parseInt(formData.get('scenesCount') as string) || 7;
  const scenesConfigRaw = formData.get('scenesConfig') as string;
  const rejectRaw = formData.get('reject') as string;

  if (!dreamDescription || dreamDescription.length < 10) {
    throw new ValidationError('dreamDescription must be at least 10 characters');
  }

  // Parse scenes config if provided
  let scenesConfig: { type: string; allowsCameraLook?: boolean }[] | undefined;
  if (scenesConfigRaw) {
    try {
      scenesConfig = JSON.parse(scenesConfigRaw);
    } catch {
      // Ignore invalid JSON
    }
  }

  const reject = rejectRaw ? rejectRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Collect photo files
  const photoEntries = formData.getAll('photos') as File[];
  if (!photoEntries.length) {
    throw new ValidationError('At least one photo is required');
  }

  // Find or create a system user for pub generations
  let pubUser = await prisma.user.findFirst({ where: { email: 'pub@sublym.system' } });
  if (!pubUser) {
    pubUser = await prisma.user.create({
      data: {
        email: 'pub@sublym.system',
        firstName: 'Pub',
        lastName: 'System',
        country: 'FR',
      },
    });
  }

  // Save photos to storage
  const photoDir = path.join(STORAGE_PATH, 'users', pubUser.id.toString(), 'photos');
  await fs.mkdir(photoDir, { recursive: true });

  // Delete existing photos for pub user
  const existingPhotos = await prisma.photo.findMany({ where: { userId: pubUser.id } });
  for (const ep of existingPhotos) {
    const filePath = path.join(STORAGE_PATH, ep.path);
    await fs.unlink(filePath).catch(() => {});
  }
  await prisma.photo.deleteMany({ where: { userId: pubUser.id } });

  const photoPaths: string[] = [];
  for (let i = 0; i < photoEntries.length; i++) {
    const file = photoEntries[i];
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `pub_${Date.now()}_${i}.jpg`;
    const fullPath = path.join(photoDir, filename);
    const relativePath = `users/${pubUser.id}/photos/${filename}`;

    const processed = await sharp(buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    await fs.writeFile(fullPath, processed);

    await prisma.photo.create({
      data: {
        userId: pubUser.id,
        filename,
        path: relativePath,
        originalName: file.name || filename,
        mimeType: 'image/jpeg',
        size: processed.length,
        order: i,
        verified: true,
      },
    });

    photoPaths.push(relativePath);
  }

  // Create dream entry
  const dream = await prisma.dream.create({
    data: {
      userId: pubUser.id,
      description: dreamDescription,
      reject,
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
      action: 'GENERATE_SCENARIO',
      target: `dream:${dream.id}`,
      details: {
        dailyContext: dailyContext || null,
        scenesCount,
        scenesConfig: scenesConfig?.map(s => s.type) || null,
        photosCount: photoPaths.length,
      },
    },
  });

  // Determine mode based on scenesConfig
  const hasTransition = scenesConfig?.some(s => s.type === 'transition_awakening' || s.type === 'transition_action');
  const mode = hasTransition ? 'scenario_pub' : 'free_scenes';

  // Start generation in background
  startGeneration(dream.id, pubUser.id, run.traceId, {
    description: dreamDescription,
    reject,
    photoPaths,
    isPhotosOnly: false,
    scenesCount: Math.max(3, Math.min(15, scenesCount)),
    keyframesCount: Math.max(3, Math.min(15, scenesCount)),
    mode,
    dailyContext: dailyContext || undefined,
    scenesConfig,
  });

  return c.json({
    success: true,
    dream: { id: dream.id },
    run: { id: run.id, traceId: run.traceId },
  });
});

// ============================================
// RUNS HISTORY
// ============================================

// GET /admin/runs - List all runs with dream and user info
app.get('/runs', adminMiddleware, async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '50');
  const status = c.req.query('status');

  const where: any = {};
  if (status) where.status = status;

  const [runs, total] = await Promise.all([
    prisma.run.findMany({
      where,
      include: {
        dream: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.run.count({ where }),
  ]);

  // Fetch photos for each user in the runs
  const userIds = [...new Set(runs.map(r => r.dream.user?.id).filter(Boolean))] as number[];
  const userPhotos = await prisma.photo.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, path: true, verified: true },
  });
  const photosByUser = userPhotos.reduce((acc, p) => {
    if (!acc[p.userId]) acc[p.userId] = [];
    acc[p.userId].push({ path: p.path, verified: p.verified });
    return acc;
  }, {} as Record<number, { path: string; verified: boolean }[]>);

  // Scan keyframes directories for each run
  const STORAGE_PATH = path.resolve(process.env.STORAGE_PATH || './storage');
  const keyframesByRun: Record<number, string[]> = {};

  for (const r of runs) {
    const userId = r.dream.user?.id;
    const dreamId = r.dream.id;
    if (userId && dreamId) {
      const keyframesDir = path.join(STORAGE_PATH, 'users', userId.toString(), 'dreams', dreamId.toString(), 'keyframes');
      try {
        const files = await fs.readdir(keyframesDir);
        const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f)).sort();
        keyframesByRun[r.id] = imageFiles.map(f => `users/${userId}/dreams/${dreamId}/keyframes/${f}`);
      } catch {
        // If videoPath exists, try deriving keyframes path from it
        if (r.videoPath) {
          const videoDir = path.dirname(r.videoPath);
          const altKeyframesDir = path.join(STORAGE_PATH, videoDir, 'keyframes');
          try {
            const files = await fs.readdir(altKeyframesDir);
            const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f)).sort();
            keyframesByRun[r.id] = imageFiles.map(f => `${videoDir}/keyframes/${f}`);
          } catch {
            keyframesByRun[r.id] = [];
          }
        } else {
          keyframesByRun[r.id] = [];
        }
      }
    }
  }

  c.header('X-Total-Count', String(total));
  c.header('X-Page', String(page));
  c.header('X-Per-Page', String(perPage));

  return c.json({
    runs: runs.map((r) => ({
      id: r.id,
      traceId: r.traceId,
      status: r.status,
      progress: r.progress,
      currentStep: r.currentStep,
      stepMessage: r.stepMessage,
      scenarioName: r.scenarioName,
      scenesCount: r.scenesCount,
      duration: r.duration,
      videoPath: r.videoPath,
      teaserPath: r.teaserPath,
      keyframesZipPath: r.keyframesZipPath,
      keyframesPaths: keyframesByRun[r.id] || [],
      isPhotosOnly: r.isPhotosOnly,
      subliminalText: r.subliminalText,
      costEur: r.costEur ? Number(r.costEur) : null,
      costDetails: r.costDetails,
      error: r.error,
      canRetry: r.canRetry,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      dream: {
        id: r.dream.id,
        description: r.dream.description,
        status: r.dream.status,
        reject: r.dream.reject,
      },
      user: r.dream.user,
      photos: r.dream.user?.id ? photosByUser[r.dream.user.id] || [] : [],
    })),
    total,
    page,
    perPage,
  });
});

// GET /admin/smile-reactions - List all smile reactions with user info
app.get('/smile-reactions', adminMiddleware, async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '50');
  const status = c.req.query('status');

  const where: any = {};
  if (status) where.status = status;

  const [reactions, total] = await Promise.all([
    prisma.smileReaction.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            lang: true,
            gender: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.smileReaction.count({ where }),
  ]);

  return c.json({
    reactions: reactions.map((r) => ({
      id: r.id,
      userId: r.userId,
      user: r.user,
      videoPath: r.videoPath,
      videoDuration: r.videoDuration,
      videoSize: r.videoSize,
      comment: r.comment,
      commentedAt: r.commentedAt,
      status: r.status,
      premiumGranted: r.premiumGranted,
      premiumLevel: r.premiumLevel,
      premiumUntil: r.premiumUntil,
      createdAt: r.createdAt,
      uploadedAt: r.uploadedAt,
    })),
    total,
    page,
    perPage,
  });
});

// DELETE /admin/runs/:id - Delete a run and its associated files
app.delete('/runs/:id', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    throw new ValidationError('Invalid run ID');
  }

  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      dream: {
        include: { user: { select: { id: true, email: true } } },
      },
    },
  });

  if (!run) {
    throw new NotFoundError('Run not found');
  }

  const STORAGE_PATH = path.resolve(process.env.STORAGE_PATH || './storage');
  const userId = run.dream.user?.id;
  const dreamId = run.dream.id;

  // Delete associated files from filesystem
  if (userId && dreamId) {
    const dreamDir = path.join(STORAGE_PATH, 'users', userId.toString(), 'dreams', dreamId.toString());
    try {
      await fs.rm(dreamDir, { recursive: true, force: true });
      console.log(`[Admin] Deleted dream directory: ${dreamDir}`);
    } catch (err) {
      console.warn(`[Admin] Failed to delete dream directory: ${dreamDir}`, err);
    }
  }

  // Also try to delete by videoPath if it's in a different location
  if (run.videoPath) {
    const videoDir = path.join(STORAGE_PATH, path.dirname(run.videoPath));
    try {
      await fs.rm(videoDir, { recursive: true, force: true });
      console.log(`[Admin] Deleted video directory: ${videoDir}`);
    } catch (err) {
      // Already deleted or doesn't exist
    }
  }

  // Delete from database (run first, then dream if no other runs reference it)
  await prisma.run.delete({ where: { id } });

  // Check if dream has other runs
  const otherRuns = await prisma.run.count({ where: { dreamId } });
  if (otherRuns === 0) {
    // Delete the dream too
    await prisma.dream.delete({ where: { id: dreamId } });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'DELETE_RUN',
      target: `run:${id}`,
      details: {
        traceId: run.traceId,
        userId,
        dreamId,
        deletedDream: otherRuns === 0,
      },
    },
  });

  return c.json({ success: true, message: 'Run deleted successfully' });
});

// GET /admin/runs/:id/validation - Get validation report for a run
app.get('/runs/:id/validation', adminMiddleware, async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    throw new ValidationError('Invalid run ID');
  }

  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      dream: { include: { user: { select: { id: true } } } },
    },
  });

  if (!run) {
    throw new NotFoundError('Run not found');
  }

  const STORAGE_PATH = path.resolve(process.env.STORAGE_PATH || './storage');
  const userId = run.dream.user?.id;
  const dreamId = run.dream.id;

  // Try to find validation_report.json in the dream directory
  const possiblePaths = [
    // Standard path
    path.join(STORAGE_PATH, 'users', userId?.toString() || '', 'dreams', dreamId.toString(), 'json', 'validation_report.json'),
    // If videoPath exists, use its directory
    run.videoPath ? path.join(STORAGE_PATH, path.dirname(run.videoPath), 'json', 'validation_report.json') : '',
  ].filter(Boolean);

  let validationReport = null;
  for (const reportPath of possiblePaths) {
    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      validationReport = JSON.parse(content);
      break;
    } catch {
      // File doesn't exist, try next path
    }
  }

  // Also try to get results.json for more context
  let resultsData = null;
  for (const reportPath of possiblePaths) {
    try {
      const resultsPath = reportPath.replace('validation_report.json', 'results.json');
      const content = await fs.readFile(resultsPath, 'utf-8');
      resultsData = JSON.parse(content);
      break;
    } catch {
      // File doesn't exist
    }
  }

  return c.json({
    runId: id,
    traceId: run.traceId,
    validationReport,
    resultsData,
    hasValidation: validationReport !== null,
  });
});

// GET /admin/runs/:id/scenario-v7 - Get v7 scenario + audit log for a run
app.get('/runs/:id/scenario-v7', adminMiddleware, async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    throw new ValidationError('Invalid run ID');
  }

  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      dream: { include: { user: { select: { id: true } } } },
    },
  });

  if (!run) {
    throw new NotFoundError('Run not found');
  }

  const STORAGE_PATH = path.resolve(process.env.STORAGE_PATH || './storage');
  const userId = run.dream.user?.id;
  const dreamId = run.dream.id;

  const possiblePaths = [
    path.join(STORAGE_PATH, 'users', userId?.toString() || '', 'dreams', dreamId.toString(), 'json'),
    run.videoPath ? path.join(STORAGE_PATH, path.dirname(run.videoPath), 'json') : '',
  ].filter(Boolean);

  let scenarioV7 = null;
  let auditLog = null;
  let scenariosFr = null;
  let scenariosEn = null;

  for (const jsonDir of possiblePaths) {
    try {
      const content = await fs.readFile(path.join(jsonDir, 'scenario_v7_full.json'), 'utf-8');
      scenarioV7 = JSON.parse(content);
      break;
    } catch {
      // File doesn't exist, try next path
    }
  }

  for (const jsonDir of possiblePaths) {
    try {
      const content = await fs.readFile(path.join(jsonDir, 'scenario_v7_audit.json'), 'utf-8');
      auditLog = JSON.parse(content);
      break;
    } catch {}
  }

  for (const jsonDir of possiblePaths) {
    try {
      const content = await fs.readFile(path.join(jsonDir, 'scenarios_video_fr.json'), 'utf-8');
      scenariosFr = JSON.parse(content);
      break;
    } catch {}
  }

  for (const jsonDir of possiblePaths) {
    try {
      const content = await fs.readFile(path.join(jsonDir, 'scenarios_video.json'), 'utf-8');
      scenariosEn = JSON.parse(content);
      break;
    } catch {}
  }

  return c.json({
    runId: id,
    traceId: run.traceId,
    scenarioV7,
    auditLog,
    scenariosFr,
    scenariosEn,
    hasV7: scenarioV7 !== null,
  });
});

// ============================================
// VALIDATION CONFIG
// ============================================

// GET /admin/validation-config
app.get('/validation-config', adminMiddleware, async (c) => {
  // Read validation configs from Config table (category: 'validation')
  const configs = await prisma.config.findMany({
    where: { category: 'validation' },
  });

  const configMap = configs.reduce((acc, cfg) => {
    acc[cfg.key] = cfg.type === 'json' ? JSON.parse(cfg.value) : cfg.type === 'number' ? Number(cfg.value) : cfg.value;
    return acc;
  }, {} as Record<string, any>);

  return c.json({
    globalMinScore: configMap['validation_global_min_score'] ?? 0.75,
    faceValidation: configMap['validation_face'] ?? { geminiMin: 0.7, tolerance: 0.4, threshold: 0.8 },
    criteria: configMap['validation_criteria'] ?? {},
    criteriaPub: configMap['validation_criteria_pub'] ?? {},
  });
});

// PUT /admin/validation-config
app.put('/validation-config', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const body = await c.req.json();

  const updates = [
    { key: 'validation_global_min_score', value: String(body.globalMinScore ?? 0.75), type: 'number', category: 'validation' },
    { key: 'validation_face', value: JSON.stringify(body.faceValidation ?? {}), type: 'json', category: 'validation' },
    { key: 'validation_criteria', value: JSON.stringify(body.criteria ?? {}), type: 'json', category: 'validation' },
    { key: 'validation_criteria_pub', value: JSON.stringify(body.criteriaPub ?? {}), type: 'json', category: 'validation' },
  ];

  for (const u of updates) {
    await prisma.config.upsert({
      where: { key: u.key },
      create: u,
      update: { value: u.value },
    });
  }

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'VALIDATION_CONFIG_UPDATE',
      target: 'validation_config',
      details: { keys: updates.map(u => u.key) },
    },
  });

  return c.json({ success: true });
});

// ============================================
// LEGAL DOCUMENTS
// ============================================

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


// ============================================
// PAGES CRUD (Versioned static pages)
// ============================================

// GET /admin/pages - list all pages grouped by slug+lang
app.get('/pages', async (c) => {
  const pages = await prisma.staticPage.findMany({
    orderBy: [{ slug: 'asc' }, { lang: 'asc' }, { version: 'desc' }],
  });
  const grouped: Record<string, any> = {};
  for (const page of pages) {
    const key = `${page.slug}:${page.lang}`;
    if (!grouped[key]) {
      grouped[key] = { slug: page.slug, lang: page.lang, title: page.title, currentVersion: page.version, enabled: page.enabled, updatedAt: page.updatedAt };
    }
  }
  return c.json({ pages: Object.values(grouped) });
});

// GET /admin/pages/:slug
app.get('/pages/:slug', async (c) => {
  const slug = c.req.param('slug');
  const lang = c.req.query('lang');
  const where: any = { slug };
  if (lang) where.lang = lang;
  const pages = await prisma.staticPage.findMany({ where, orderBy: [{ lang: 'asc' }, { version: 'desc' }] });
  if (pages.length === 0) throw new NotFoundError('Page');
  const byLang: Record<string, any> = {};
  for (const page of pages) { if (!byLang[page.lang]) byLang[page.lang] = page; }
  return c.json({ slug, pages: Object.values(byLang) });
});

// GET /admin/pages/:slug/versions
app.get('/pages/:slug/versions', async (c) => {
  const slug = c.req.param('slug');
  const lang = c.req.query('lang') || 'fr';
  const versions = await prisma.staticPage.findMany({
    where: { slug, lang }, orderBy: { version: 'desc' },
    select: { id: true, version: true, title: true, enabled: true, publishedBy: true, createdAt: true, updatedAt: true },
  });
  return c.json({ slug, lang, versions });
});

// PUT /admin/pages/:slug - publish new version
const updatePageSchema = z.object({
  lang: z.string().min(2).max(5),
  title: z.string().min(1),
  content: z.string().min(1),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
});

app.put('/pages/:slug', zValidator('json', updatePageSchema, (result, c) => {
  if (!result.success) {
    return c.json({
      error: 'VALIDATION_ERROR',
      message: `Données invalides : ${result.error.issues.map(i => i.message).join(', ')}`,
    }, 400);
  }
}), async (c) => {
  const { admin } = getAdminContext(c);
  const slug = c.req.param('slug');
  const data = c.req.valid('json');
  try {
    const current = await prisma.staticPage.findFirst({ where: { slug, lang: data.lang }, orderBy: { version: 'desc' } });
    const newVersion = current ? current.version + 1 : 1;
    if (current) { await prisma.staticPage.updateMany({ where: { slug, lang: data.lang }, data: { enabled: false } }); }
    const page = await prisma.staticPage.create({
      data: { slug, lang: data.lang, title: data.title, content: data.content, metaTitle: data.metaTitle, metaDescription: data.metaDescription, version: newVersion, enabled: true, publishedBy: admin.id },
    });
    await prisma.auditLog.create({ data: { adminId: admin.id, action: 'PAGE_PUBLISH', target: `page:${slug}:${data.lang}:v${newVersion}`, details: { slug, lang: data.lang, version: newVersion } } });
    return c.json({ success: true, page });
  } catch (err: any) {
    console.error('Error saving page:', slug, data.lang, err.message);
    throw err;
  }
});

// ============================================
// PRICING (CRUD pricing levels)
// ============================================

// GET /admin/pricing - List all pricing levels (including disabled)
app.get('/pricing', async (c) => {
  const levels = await prisma.pricingLevel.findMany({
    orderBy: [{ displayOrder: 'asc' }, { level: 'asc' }],
  });

  return c.json({
    levels: levels.map((l) => ({
      id: l.id,
      level: l.level,
      name: l.name,
      description: l.description,
      photosMin: l.photosMin,
      photosMax: l.photosMax,
      keyframesCount: l.keyframesCount,
      videoEnabled: l.videoEnabled,
      scenesCount: l.scenesCount,
      generationsPerMonth: l.generationsPerMonth,
      subliminalEnabled: l.subliminalEnabled,
      priceMonthly: Number(l.priceMonthly),
      priceYearly: Number(l.priceYearly),
      priceOneShot: l.priceOneShot != null ? Number(l.priceOneShot) : null,
      currency: l.currency,
      enabled: l.enabled,
      displayOrder: l.displayOrder,
      badgeText: l.badgeText,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  });
});

app.put('/pricing', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const body = await c.req.json();
  const { levels } = body;
  if (!Array.isArray(levels)) throw new ValidationError('levels must be an array');
  const results = [];
  for (const level of levels) {
    if (level.id) {
      const updated = await prisma.pricingLevel.update({
        where: { id: level.id },
        data: { name: level.name, description: level.description, photosMin: level.photosMin, photosMax: level.photosMax, keyframesCount: level.keyframesCount, videoEnabled: level.videoEnabled, scenesCount: level.scenesCount, generationsPerMonth: level.generationsPerMonth, subliminalEnabled: level.subliminalEnabled, priceMonthly: level.priceMonthly, priceYearly: level.priceYearly, priceOneShot: level.priceOneShot, currency: level.currency || 'EUR', enabled: level.enabled, displayOrder: level.displayOrder, badgeText: level.badgeText },
      });
      results.push(updated);
    } else {
      const created = await prisma.pricingLevel.create({
        data: { level: level.level, name: level.name, description: level.description, photosMin: level.photosMin || 3, photosMax: level.photosMax || 5, keyframesCount: level.keyframesCount || 5, videoEnabled: level.videoEnabled ?? true, scenesCount: level.scenesCount || 5, generationsPerMonth: level.generationsPerMonth || 1, subliminalEnabled: level.subliminalEnabled ?? false, priceMonthly: level.priceMonthly, priceYearly: level.priceYearly, priceOneShot: level.priceOneShot, currency: level.currency || 'EUR', enabled: level.enabled ?? true, displayOrder: level.displayOrder || 0, badgeText: level.badgeText },
      });
      results.push(created);
    }
  }
  await prisma.auditLog.create({ data: { adminId: admin.id, action: 'PRICING_UPDATE', details: { levelsCount: levels.length } } });
  return c.json({ success: true, levels: results });
});

// POST /admin/pricing - Create a new pricing level (superadmin only)
const createPricingSchema = z.object({
  level: z.number().int().min(0),
  name: z.string().min(1),
  description: z.string().optional(),
  photosMin: z.number().int().min(1).default(3),
  photosMax: z.number().int().min(1).default(5),
  keyframesCount: z.number().int().min(1).default(5),
  videoEnabled: z.boolean().default(true),
  scenesCount: z.number().int().min(1).default(5),
  generationsPerMonth: z.number().int().default(1),
  subliminalEnabled: z.boolean().default(false),
  priceMonthly: z.number().or(z.string()),
  priceYearly: z.number().or(z.string()),
  priceOneShot: z.number().or(z.string()).optional(),
  currency: z.string().default('EUR'),
  enabled: z.boolean().default(true),
  badgeText: z.string().optional(),
});

app.post('/pricing', superadminMiddleware, zValidator('json', createPricingSchema), async (c) => {
  const { admin } = getAdminContext(c);
  const data = c.req.valid('json');

  // Check if level number already exists
  const existingLevel = await prisma.pricingLevel.findUnique({
    where: { level: data.level },
  });
  if (existingLevel) {
    throw new ValidationError(`Pricing level ${data.level} already exists`);
  }

  // Auto-set displayOrder to max+1
  const maxOrder = await prisma.pricingLevel.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

  const pricingLevel = await prisma.pricingLevel.create({
    data: {
      level: data.level,
      name: data.name,
      description: data.description,
      photosMin: data.photosMin,
      photosMax: data.photosMax,
      keyframesCount: data.keyframesCount,
      videoEnabled: data.videoEnabled,
      scenesCount: data.scenesCount,
      generationsPerMonth: data.generationsPerMonth,
      subliminalEnabled: data.subliminalEnabled,
      priceMonthly: data.priceMonthly,
      priceYearly: data.priceYearly,
      priceOneShot: data.priceOneShot,
      currency: data.currency,
      enabled: data.enabled,
      displayOrder,
      badgeText: data.badgeText,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'PRICING_CREATE',
      target: `pricing:${pricingLevel.id}`,
      details: { level: data.level, name: data.name, displayOrder },
    },
  });

  return c.json({ success: true, pricingLevel }, 201);
});

// DELETE /admin/pricing/:id - Delete a pricing level (superadmin only)
app.delete('/pricing/:id', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const id = parseInt(c.req.param('id'));

  const pricingLevel = await prisma.pricingLevel.findUnique({
    where: { id },
  });
  if (!pricingLevel) {
    throw new NotFoundError('Pricing level');
  }

  // Check if any active subscribers are at this level
  const subscribersCount = await prisma.user.count({
    where: {
      subscriptionLevel: pricingLevel.level,
      deletedAt: null,
    },
  });

  if (subscribersCount > 0) {
    return c.json({
      error: 'SUBSCRIBERS_EXIST',
      message: `Cannot delete pricing level "${pricingLevel.name}": ${subscribersCount} active subscriber(s) at this level. Migrate them first.`,
      subscribersCount,
    }, 409);
  }

  await prisma.pricingLevel.delete({ where: { id } });

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'PRICING_DELETE',
      target: `pricing:${id}`,
      details: { level: pricingLevel.level, name: pricingLevel.name },
    },
  });

  return c.json({ success: true, message: `Pricing level "${pricingLevel.name}" deleted` });
});

// ============================================
// SCENE TYPES (Generation pipeline config)
// ============================================

// GET /admin/scene-types - List all scene types
app.get('/scene-types', async (c) => {
  const sceneTypes = await prisma.sceneType.findMany({
    orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
  });

  return c.json({ sceneTypes });
});

// POST /admin/scene-types - Create a new scene type
const createSceneTypeSchema = z.object({
  code: z.string().min(1).max(50),
  mode: z.string().default('all'),
  description: z.string().min(1),
  minRatio: z.number().min(0).max(1).default(0),
  maxRatio: z.number().min(0).max(1).default(1),
  examples: z.array(z.string()).default([]),
  position: z.string().nullable().optional(),
  allowsCameraLook: z.boolean().default(false),
  enabled: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

app.post('/scene-types', superadminMiddleware, zValidator('json', createSceneTypeSchema), async (c) => {
  const { admin } = getAdminContext(c);
  const data = c.req.valid('json');

  const sceneType = await prisma.sceneType.create({
    data: {
      code: data.code.toUpperCase(),
      mode: data.mode,
      description: data.description,
      minRatio: data.minRatio,
      maxRatio: data.maxRatio,
      examples: data.examples,
      position: data.position || null,
      allowsCameraLook: data.allowsCameraLook,
      enabled: data.enabled,
      displayOrder: data.displayOrder,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'SCENE_TYPE_CREATE',
      target: `scene_type:${sceneType.id}`,
      details: { code: sceneType.code, mode: sceneType.mode },
    },
  });

  return c.json({ success: true, sceneType }, 201);
});

// PUT /admin/scene-types/:id - Update a scene type
const updateSceneTypeSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  mode: z.string().optional(),
  description: z.string().min(1).optional(),
  minRatio: z.number().min(0).max(1).optional(),
  maxRatio: z.number().min(0).max(1).optional(),
  examples: z.array(z.string()).optional(),
  position: z.string().nullable().optional(),
  allowsCameraLook: z.boolean().optional(),
  enabled: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

app.put('/scene-types/:id', superadminMiddleware, zValidator('json', updateSceneTypeSchema), async (c) => {
  const { admin } = getAdminContext(c);
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');

  const existing = await prisma.sceneType.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('SceneType');

  const updateData: any = { ...data };
  if (data.code) updateData.code = data.code.toUpperCase();

  const sceneType = await prisma.sceneType.update({
    where: { id },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'SCENE_TYPE_UPDATE',
      target: `scene_type:${id}`,
      details: { code: sceneType.code, changes: data },
    },
  });

  return c.json({ success: true, sceneType });
});

// DELETE /admin/scene-types/:id - Delete a scene type
app.delete('/scene-types/:id', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const id = parseInt(c.req.param('id'));

  const existing = await prisma.sceneType.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('SceneType');

  await prisma.sceneType.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'SCENE_TYPE_DELETE',
      target: `scene_type:${id}`,
      details: { code: existing.code, mode: existing.mode },
    },
  });

  return c.json({ success: true, message: `Scene type "${existing.code}" deleted` });
});

// ============================================
// PROMPT TEMPLATES (Generation pipeline prompts)
// ============================================

// GET /admin/prompts - List all prompts
app.get('/prompts', async (c) => {
  const prompts = await prisma.promptTemplate.findMany({
    orderBy: [{ category: 'asc' }, { code: 'asc' }],
  });

  return c.json({ prompts });
});

// GET /admin/prompts/:id - Get prompt detail
app.get('/prompts/:id', async (c) => {
  const id = parseInt(c.req.param('id'));

  const prompt = await prisma.promptTemplate.findUnique({ where: { id } });
  if (!prompt) throw new NotFoundError('PromptTemplate');

  return c.json({ prompt });
});

// PUT /admin/prompts/:id - Update a prompt
const updatePromptSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  template: z.string().min(1).optional(),
  templateEn: z.string().nullable().optional(),
  category: z.string().optional(),
  enabled: z.boolean().optional(),
});

app.put('/prompts/:id', superadminMiddleware, zValidator('json', updatePromptSchema), async (c) => {
  const { admin } = getAdminContext(c);
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');

  const existing = await prisma.promptTemplate.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('PromptTemplate');

  // Increment version on template change
  const updateData: any = { ...data };
  if (data.template && data.template !== existing.template) {
    updateData.version = existing.version + 1;
  }

  const prompt = await prisma.promptTemplate.update({
    where: { id },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'PROMPT_UPDATE',
      target: `prompt:${id}`,
      details: { code: prompt.code, version: prompt.version },
    },
  });

  return c.json({ success: true, prompt });
});

// POST /admin/prompts/:id/duplicate - Duplicate a prompt (for versioning)
app.post('/prompts/:id/duplicate', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const id = parseInt(c.req.param('id'));

  const existing = await prisma.promptTemplate.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('PromptTemplate');

  const newCode = `${existing.code}_COPY_${Date.now()}`;

  const prompt = await prisma.promptTemplate.create({
    data: {
      code: newCode,
      name: `${existing.name} (copie)`,
      description: existing.description,
      template: existing.template,
      category: existing.category,
      version: 1,
      enabled: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'PROMPT_DUPLICATE',
      target: `prompt:${prompt.id}`,
      details: { originalCode: existing.code, newCode },
    },
  });

  return c.json({ success: true, prompt }, 201);
});

// POST /admin/prompts/reset/:code - Reset prompt to hardcoded default
app.post('/prompts/reset/:code', superadminMiddleware, async (c) => {
  const { admin } = getAdminContext(c);
  const code = c.req.param('code');

  const existing = await prisma.promptTemplate.findUnique({ where: { code } });
  if (!existing) throw new NotFoundError('PromptTemplate');

  // Read the original template from the Python file
  const templatesPath = path.join(process.cwd(), '..', 'generation', 'prompts', 'templates.py');
  let originalTemplate: string | null = null;

  try {
    const content = await fs.readFile(templatesPath, 'utf-8');
    const varName = `PROMPT_${code}`;
    const regex = new RegExp(`${varName}\\s*=\\s*"""([\\s\\S]*?)"""`, 'm');
    const match = content.match(regex);
    if (match) {
      originalTemplate = match[1].trim();
    }
  } catch (err) {
    console.error('Failed to read templates.py for reset:', err);
  }

  if (!originalTemplate) {
    throw new ValidationError(`Could not find original template for code "${code}" in templates.py`);
  }

  const prompt = await prisma.promptTemplate.update({
    where: { code },
    data: {
      template: originalTemplate,
      version: existing.version + 1,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'PROMPT_RESET',
      target: `prompt:${prompt.id}`,
      details: { code, version: prompt.version },
    },
  });

  return c.json({ success: true, prompt });
});

// ============================================
// SMILE CONFIG
// ============================================

// GET /admin/smile-configs
app.get('/smile-configs', async (c) => {
  const configs = await prisma.smileConfig.findMany({
    orderBy: { country: 'asc' },
  });
  return c.json({ configs });
});

// POST /admin/smile-configs
app.post('/smile-configs', async (c) => {
  const { admin } = getAuthContext(c);
  const body = await c.req.json();

  const config = await prisma.smileConfig.create({
    data: {
      country: body.country || 'ALL',
      threshold: body.threshold || 1000,
      currentCount: 0,
      isActive: body.isActive ?? true,
      premiumLevel: body.premiumLevel || 3,
      premiumMonths: body.premiumMonths || 3,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'SMILE_CONFIG_CREATE',
      target: `smile_config:${config.id}`,
      details: { country: config.country },
    },
  });

  return c.json({ success: true, config });
});

// PUT /admin/smile-configs/:id
app.put('/smile-configs/:id', async (c) => {
  const { admin } = getAuthContext(c);
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();

  const config = await prisma.smileConfig.update({
    where: { id },
    data: {
      country: body.country,
      threshold: body.threshold,
      isActive: body.isActive,
      premiumLevel: body.premiumLevel,
      premiumMonths: body.premiumMonths,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'SMILE_CONFIG_UPDATE',
      target: `smile_config:${config.id}`,
      details: body,
    },
  });

  return c.json({ success: true, config });
});

// DELETE /admin/smile-configs/:id
app.delete('/smile-configs/:id', async (c) => {
  const { admin } = getAuthContext(c);
  const id = parseInt(c.req.param('id'));

  await prisma.smileConfig.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'SMILE_CONFIG_DELETE',
      target: `smile_config:${id}`,
    },
  });

  return c.json({ success: true });
});

export { app as adminRoutes };
