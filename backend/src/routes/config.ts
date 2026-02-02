// SUBLYM Backend - Config Routes
// Public configuration endpoints

import { Hono } from 'hono';
import { prisma } from '../db';
import { NotFoundError } from '../middleware/error-handler';

const app = new Hono();

// ============================================
// GET /config/texts/:lang
// ============================================

app.get('/texts/:lang', async (c) => {
  const lang = c.req.param('lang');
  
  // Get all texts for this language
  let texts = await prisma.text.findMany({
    where: { lang },
    select: { key: true, value: true },
  });
  
  // If no texts found, fallback to English
  if (texts.length === 0 && lang !== 'en') {
    texts = await prisma.text.findMany({
      where: { lang: 'en' },
      select: { key: true, value: true },
    });
  }
  
  // Convert to key-value object
  const textsMap = texts.reduce((acc, t) => {
    acc[t.key] = t.value;
    return acc;
  }, {} as Record<string, string>);
  
  return c.json(textsMap);
});

// ============================================
// GET /config/pricing
// ============================================

app.get('/pricing', async (c) => {
  const lang = c.req.query('lang') || 'fr';
  
  // Get all enabled pricing levels
  const levels = await prisma.pricingLevel.findMany({
    where: { enabled: true },
    orderBy: { displayOrder: 'asc' },
  });
  
  // Get pricing-related texts for localization
  const texts = await prisma.text.findMany({
    where: {
      lang,
      key: { startsWith: 'pricing.' },
    },
  });
  
  const textsMap = texts.reduce((acc, t) => {
    acc[t.key] = t.value;
    return acc;
  }, {} as Record<string, string>);
  
  return c.json({
    levels: levels.map((level) => ({
      level: level.level,
      name: textsMap[`pricing.level_${level.level}.name`] || level.name,
      description: textsMap[`pricing.level_${level.level}.description`] || level.description,
      features: {
        photosMin: level.photosMin,
        photosMax: level.photosMax,
        keyframesCount: level.keyframesCount,
        videoEnabled: level.videoEnabled,
        scenesCount: level.scenesCount,
        generationsPerMonth: level.generationsPerMonth,
        subliminalEnabled: level.subliminalEnabled,
      },
      price: {
        monthly: Number(level.priceMonthly),
        yearly: Number(level.priceYearly),
        currency: level.currency,
      },
      badgeText: level.badgeText,
    })),
  });
});

// ============================================
// GET /config/languages
// ============================================

app.get('/languages', async (c) => {
  // Get distinct languages from texts
  const languages = await prisma.text.findMany({
    select: { lang: true },
    distinct: ['lang'],
  });
  
  const langInfo: Record<string, { name: string; flag: string }> = {
    fr: { name: 'Français', flag: '🇫🇷' },
    en: { name: 'English', flag: '🇬🇧' },
    de: { name: 'Deutsch', flag: '🇩🇪' },
    es: { name: 'Español', flag: '🇪🇸' },
    it: { name: 'Italiano', flag: '🇮🇹' },
  };
  
  return c.json({
    languages: languages.map((l) => ({
      code: l.lang,
      name: langInfo[l.lang]?.name || l.lang,
      flag: langInfo[l.lang]?.flag || '🌍',
    })),
    default: 'fr',
  });
});

// ============================================
// GET /config/smile-status
// ============================================

app.get('/smile-status', async (c) => {
  const country = c.req.query('country') || 'ALL';
  
  // Check country-specific config first, then global
  let smileConfig = await prisma.smileConfig.findUnique({
    where: { country },
  });
  
  if (!smileConfig) {
    smileConfig = await prisma.smileConfig.findUnique({
      where: { country: 'ALL' },
    });
  }
  
  if (!smileConfig) {
    return c.json({
      available: false,
      reason: 'not_configured',
    });
  }
  
  const available = smileConfig.isActive && smileConfig.currentCount < smileConfig.threshold;
  
  return c.json({
    available,
    reason: !smileConfig.isActive ? 'disabled' : !available ? 'threshold_reached' : null,
    remaining: available ? smileConfig.threshold - smileConfig.currentCount : 0,
    premiumLevel: smileConfig.premiumLevel,
    premiumMonths: smileConfig.premiumMonths,
  });
});

// ============================================
// GET /config/limits
// ============================================

app.get('/limits', async (c) => {
  // Get relevant config values
  const configs = await prisma.config.findMany({
    where: {
      category: { in: ['limits', 'generation'] },
    },
  });
  
  const configMap = configs.reduce((acc, cfg) => {
    acc[cfg.key] = cfg.type === 'number' ? Number(cfg.value) : cfg.value;
    return acc;
  }, {} as Record<string, string | number>);
  
  return c.json({
    dream: {
      textMinChars: configMap['dream_text_min_chars'] || 20,
      textMaxChars: configMap['dream_text_max_chars'] || 300,
    },
    photo: {
      maxSizeMb: configMap['photo_max_size_mb'] || 8,
      maxDimension: configMap['photo_max_dimension'] || 1024,
      formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
    },
    video: {
      maxDurationSeconds: configMap['video_testimony_max_duration'] || 120,
      maxSizeMb: configMap['video_testimony_max_size_mb'] || 100,
      formats: ['mp4', 'mov', 'webm'],
    },
    generation: {
      timeoutMinutes: configMap['generation_timeout_minutes'] || 10,
      pollingIntervalSeconds: configMap['generation_polling_interval_seconds'] || 5,
    },
  });
});

// ============================================
// GET /config/pages/:slug
// ============================================

app.get('/pages/:slug', async (c) => {
  const slug = c.req.param('slug');
  const lang = c.req.query('lang') || 'fr';
  
  // Try to find page in requested language
  let page = await prisma.staticPage.findUnique({
    where: { slug_lang: { slug, lang } },
  });
  
  // Fallback to English
  if (!page && lang !== 'en') {
    page = await prisma.staticPage.findUnique({
      where: { slug_lang: { slug, lang: 'en' } },
    });
  }
  
  if (!page || !page.enabled) {
    throw new NotFoundError('Page');
  }
  
  return c.json({
    slug: page.slug,
    title: page.title,
    content: page.content,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
  });
});

// ============================================
// GET /config/faq
// ============================================

app.get('/faq', async (c) => {
  const lang = c.req.query('lang') || 'fr';
  const category = c.req.query('category');
  
  const where: any = { lang, enabled: true };
  if (category) {
    where.category = category;
  }
  
  const items = await prisma.faqItem.findMany({
    where,
    orderBy: [
      { category: 'asc' },
      { order: 'asc' },
    ],
  });
  
  // Group by category
  const grouped = items.reduce((acc, item) => {
    const cat = item.category || 'general';
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push({
      id: item.id,
      question: item.question,
      answer: item.answer,
    });
    return acc;
  }, {} as Record<string, Array<{ id: number; question: string; answer: string }>>);
  
  return c.json({
    categories: Object.keys(grouped),
    items: grouped,
  });
});

export { app as configRoutes };
