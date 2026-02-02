// SUBLYM Backend - Seed Prisma
// Version 1.0 - 27 janvier 2026

import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

function flattenJSON(obj: Record<string, any>, prefix = ''): { key: string; value: string }[] {
  const result: { key: string; value: string }[] = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      result.push(...flattenJSON(obj[k], fullKey));
    } else {
      result.push({ key: fullKey, value: String(obj[k]) });
    }
  }
  return result;
}

async function main() {
  console.log('🌱 Seeding database...');

  // ============================================
  // CONFIG
  // ============================================
  
  const configData: Prisma.ConfigCreateInput[] = [
    // Stripe
    { key: 'stripe_mode', value: 'test', type: 'string', category: 'stripe' },
    
    // Rekognition
    { key: 'rekognition_threshold', value: '80', type: 'number', category: 'rekognition' },
    { key: 'rekognition_quality_min', value: '80', type: 'number', category: 'rekognition' },
    
    // Limites générales
    { key: 'dream_text_min_chars', value: '20', type: 'number', category: 'limits' },
    { key: 'dream_text_max_chars', value: '300', type: 'number', category: 'limits' },
    { key: 'photo_max_size_mb', value: '8', type: 'number', category: 'limits' },
    { key: 'photo_max_dimension', value: '1024', type: 'number', category: 'limits' },
    { key: 'video_testimony_max_duration', value: '120', type: 'number', category: 'limits' },
    { key: 'video_testimony_max_size_mb', value: '100', type: 'number', category: 'limits' },
    
    // Smile
    { key: 'smile_premium_level', value: '3', type: 'number', category: 'smile' },
    { key: 'smile_premium_months', value: '3', type: 'number', category: 'smile' },
    { key: 'smile_video_max_size_mb', value: '100', type: 'number', category: 'smile' },
    
    // Auth
    { key: 'magic_link_expiry_minutes', value: '30', type: 'number', category: 'auth' },
    { key: 'magic_link_rate_limit_per_hour', value: '3', type: 'number', category: 'auth' },
    { key: 'jwt_access_expiry', value: '7d', type: 'string', category: 'auth' },
    { key: 'jwt_refresh_expiry', value: '30d', type: 'string', category: 'auth' },
    
    // Rate limiting
    { key: 'rate_limit_global_per_minute', value: '100', type: 'number', category: 'rate_limit' },
    { key: 'rate_limit_upload_per_minute', value: '10', type: 'number', category: 'rate_limit' },
    { key: 'rate_limit_generate_per_minute', value: '10', type: 'number', category: 'rate_limit' },
    
    // Generation
    { key: 'generation_timeout_minutes', value: '25', type: 'number', category: 'generation' },
    { key: 'generation_polling_interval_seconds', value: '5', type: 'number', category: 'generation' },
    { key: 'generation_max_attempts', value: '5', type: 'number', category: 'generation' },
    { key: 'generation_max_video_attempts', value: '4', type: 'number', category: 'generation' },
    { key: 'generation_model_scenario', value: 'gpt-4o', type: 'string', category: 'generation' },
    { key: 'generation_model_image', value: 'gemini-3-pro-image-preview', type: 'string', category: 'generation' },
    { key: 'generation_model_video', value: 'fal-ai/minimax/hailuo-02/standard/image-to-video', type: 'string', category: 'generation' },
    
    // Grace period
    { key: 'payment_grace_period_days', value: '7', type: 'number', category: 'payment' },
    
    // Cleanup
    { key: 'soft_delete_purge_days', value: '30', type: 'number', category: 'cleanup' },
    { key: 'failed_runs_cleanup_days', value: '7', type: 'number', category: 'cleanup' },

    // Sublym (company data)
    { key: 'sublym_email_webmaster', value: 'webmaster@sublym.org', type: 'string', category: 'sublym' },
    { key: 'sublym_email_contact', value: 'contact@sublym.org', type: 'string', category: 'sublym' },
    { key: 'sublym_email_support', value: 'support@sublym.org', type: 'string', category: 'sublym' },
    { key: 'sublym_email_noreply', value: 'noreply@sublym.org', type: 'string', category: 'sublym' },
    { key: 'sublym_company_name', value: 'SUBLYM SAS', type: 'string', category: 'sublym' },
    { key: 'sublym_address_street', value: '', type: 'string', category: 'sublym' },
    { key: 'sublym_address_zip', value: '', type: 'string', category: 'sublym' },
    { key: 'sublym_address_city', value: '', type: 'string', category: 'sublym' },
    { key: 'sublym_address_country', value: 'France', type: 'string', category: 'sublym' },
    { key: 'sublym_siret', value: '', type: 'string', category: 'sublym' },
    { key: 'sublym_phone', value: '', type: 'string', category: 'sublym' },
  ];

  for (const config of configData) {
    await prisma.config.upsert({
      where: { key: config.key },
      update: config,
      create: config,
    });
  }
  console.log('✅ Config seeded');

  // ============================================
  // PRICING LEVELS
  // ============================================
  
  const pricingLevels: Prisma.PricingLevelCreateInput[] = [
    {
      level: 0,
      name: 'Gratuit',
      description: 'Découvrez SUBLYM avec une génération gratuite',
      photosMin: 3,
      photosMax: 3,
      keyframesCount: 3,
      videoEnabled: false,
      scenesCount: 0,
      generationsPerMonth: 0,
      subliminalEnabled: false,
      priceMonthly: 0,
      priceYearly: 0,
      enabled: true,
      displayOrder: 0,
    },
    {
      level: 1,
      name: 'Découverte',
      description: 'Visualisez vos rêves en images',
      photosMin: 3,
      photosMax: 3,
      keyframesCount: 3,
      videoEnabled: false,
      scenesCount: 0,
      generationsPerMonth: 1,
      subliminalEnabled: false,
      priceMonthly: 4.99,
      priceYearly: 49.99,
      enabled: true,
      displayOrder: 1,
    },
    {
      level: 2,
      name: 'Essentiel',
      description: 'Vos rêves prennent vie en vidéo',
      photosMin: 3,
      photosMax: 5,
      keyframesCount: 5,
      videoEnabled: true,
      scenesCount: 5,
      generationsPerMonth: 3,
      subliminalEnabled: false,
      priceMonthly: 9.99,
      priceYearly: 99.99,
      enabled: true,
      displayOrder: 2,
      badgeText: 'Populaire',
    },
    {
      level: 3,
      name: 'Premium',
      description: 'L\'expérience ultime avec messages subliminaux',
      photosMin: 3,
      photosMax: 5,
      keyframesCount: 7,
      videoEnabled: true,
      scenesCount: 7,
      generationsPerMonth: -1, // Illimité
      subliminalEnabled: true,
      priceMonthly: 19.99,
      priceYearly: 199.99,
      enabled: true,
      displayOrder: 3,
      badgeText: 'Best value',
    },
  ];

  for (const level of pricingLevels) {
    await prisma.pricingLevel.upsert({
      where: { level: level.level },
      update: level,
      create: level,
    });
  }
  console.log('✅ Pricing levels seeded');

  // ============================================
  // SMILE CONFIG
  // ============================================
  
  await prisma.smileConfig.upsert({
    where: { country: 'ALL' },
    update: {},
    create: {
      country: 'ALL',
      threshold: 1000,
      currentCount: 0,
      isActive: true,
      premiumLevel: 3,
      premiumMonths: 3,
    },
  });
  console.log('✅ Smile config seeded');

  // ============================================
  // AI PROVIDERS
  // ============================================
  
  const aiProviders: Prisma.AIProviderCreateInput[] = [
    {
      name: 'gpt-4o',
      displayName: 'GPT-4o (OpenAI)',
      category: 'text',
      priority: 1,
      enabled: true,
    },
    {
      name: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini (OpenAI)',
      category: 'text',
      priority: 2,
      enabled: true,
    },
    {
      name: 'gemini-3-pro',
      displayName: 'Gemini 3 Pro (Google)',
      category: 'image',
      priority: 1,
      enabled: true,
    },
    {
      name: 'gemini-flash',
      displayName: 'Gemini Flash (Google)',
      category: 'image',
      priority: 2,
      enabled: true,
    },
    {
      name: 'minimax-hailuo',
      displayName: 'Hailuo (MiniMax)',
      category: 'video',
      priority: 1,
      enabled: true,
    },
  ];

  for (const provider of aiProviders) {
    await prisma.aIProvider.upsert({
      where: { name: provider.name },
      update: provider,
      create: provider,
    });
  }
  
  // Set fallback relationships
  const gpt4oMini = await prisma.aIProvider.findUnique({ where: { name: 'gpt-4o-mini' } });
  const geminiFlash = await prisma.aIProvider.findUnique({ where: { name: 'gemini-flash' } });
  
  if (gpt4oMini) {
    await prisma.aIProvider.update({
      where: { name: 'gpt-4o' },
      data: { fallbackProviderId: gpt4oMini.id },
    });
  }
  if (geminiFlash) {
    await prisma.aIProvider.update({
      where: { name: 'gemini-3-pro' },
      data: { fallbackProviderId: geminiFlash.id },
    });
  }
  console.log('✅ AI Providers seeded');

  // ============================================
  // ADMIN USERS
  // ============================================
  
  const adminPassword = await bcrypt.hash('admin123!', 12);
  
  await prisma.adminUser.upsert({
    where: { email: 'admin@sublym.org' },
    update: {},
    create: {
      email: 'admin@sublym.org',
      passwordHash: adminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'superadmin',
    },
  });
  console.log('✅ Admin users seeded');

  // ============================================
  // TEST ACCOUNTS
  // ============================================
  
  const testAccounts = [
    { email: 'test-free@sublym.org', firstName: 'Test', lastName: 'Free', subscriptionLevel: 0 },
    { email: 'test-level1@sublym.org', firstName: 'Test', lastName: 'Level1', subscriptionLevel: 1 },
    { email: 'test-level2@sublym.org', firstName: 'Test', lastName: 'Level2', subscriptionLevel: 2 },
    { email: 'test-level3@sublym.org', firstName: 'Test', lastName: 'Level3', subscriptionLevel: 3 },
  ];

  for (const account of testAccounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: {
        ...account,
        isTestAccount: true,
        rgpdConsent: true,
        rgpdConsentAt: new Date(),
      },
    });
  }
  console.log('✅ Test accounts seeded');

  // ============================================
  // TEXTS (from locale JSON files)
  // ============================================
  
  const localesDir = path.resolve(__dirname, '../../frontend/src/locales');
  const languages = ['fr', 'en', 'de', 'es', 'it'];
  
  for (const lang of languages) {
    const filePath = path.join(localesDir, `${lang}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Locale file not found: ${filePath}, skipping`);
      continue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw);
    const entries = flattenJSON(json);
    
    for (const entry of entries) {
      await prisma.text.upsert({
        where: { lang_key: { lang, key: entry.key } },
        update: { value: entry.value },
        create: { lang, key: entry.key, value: entry.value },
      });
    }
    console.log(`✅ Texts (${lang.toUpperCase()}) seeded: ${entries.length} entries`);
  }

  // ============================================
  // STATIC PAGES
  // ============================================
  
  const staticPages = [
    {
      slug: 'conditions',
      lang: 'fr',
      title: 'Conditions Générales d\'Utilisation',
      content: '<h1>CGU SUBLYM</h1><p>À compléter...</p>',
      metaTitle: 'CGU - SUBLYM',
    },
    {
      slug: 'privacy',
      lang: 'fr',
      title: 'Politique de Confidentialité',
      content: '<h1>Politique de Confidentialité</h1><p>À compléter...</p>',
      metaTitle: 'Confidentialité - SUBLYM',
    },
  ];

  for (const page of staticPages) {
    await prisma.staticPage.upsert({
      where: { slug_lang_version: { slug: page.slug, lang: page.lang, version: 1 } },
      update: page,
      create: { ...page, version: 1 },
    });
  }
  console.log('✅ Static pages seeded');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
