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

    // Validation
    { key: 'validation_global_min_score', value: '0.75', type: 'number', category: 'validation' },
    { key: 'validation_face', value: JSON.stringify({ geminiMin: 0.7, tolerance: 0.4, threshold: 0.8 }), type: 'json', category: 'validation' },
    { key: 'validation_criteria', value: JSON.stringify({
      face_similarity: { min: 0.8, ref: 'user_photo', label: 'Ressemblance faciale avec la photo de référence' },
      body_type: { min: 0.7, ref: 'user_photo', label: 'Morphologie corporelle cohérente' },
      skin_tone: { min: 0.8, ref: 'user_photo', label: 'Teint de peau identique' },
      hair_consistency: { min: 0.7, ref: 'character_analysis', label: 'Coiffure cohérente avec l\'analyse' },
      scene_match: { min: 0.7, ref: 'pitch', label: 'Correspondance avec la description de scène' },
      palette_adherence: { min: 0.6, ref: 'scene_palette', label: 'Respect de la palette de couleurs' },
      no_anatomical_errors: { min: 0.8, ref: 'none', label: 'Absence d\'erreurs anatomiques' },
      no_text: { min: 0.9, ref: 'none', label: 'Absence de texte visible' },
      no_mirror: { min: 0.9, ref: 'none', label: 'Absence de miroir ou surface réfléchissante' },
      expression_natural: { min: 0.7, ref: 'none', label: 'Expression naturelle, non exagérée' },
      location_coherence: { min: 0.7, ref: 'dream_context', label: 'Le décor correspond-il au lieu décrit dans le rêve ?', examples_fail: ['Rêve Afrique → parc européen', 'Rêve plage → forêt de sapins'] },
      outfit_coherence: { min: 0.7, ref: 'dream_context', label: 'La tenue est-elle adaptée au contexte et à l\'activité ?', examples_fail: ['S\'occuper d\'enfants en brousse → chemise habillée', 'Randonnée → talons hauts'] },
      secondary_characters_coherence: { min: 0.7, ref: 'dream_context', label: 'Les personnages secondaires sont-ils cohérents avec le contexte ?', examples_fail: ['Enfants africains → enfants européens en pulls', 'Village mexicain → foule scandinave'] },
    }), type: 'json', category: 'validation' },
    { key: 'validation_criteria_pub', value: JSON.stringify({
      transition_smoothness: { min: 0.7, ref: 'previous', label: 'Transition fluide entre les deux états' },
      emotion_authenticity: { min: 0.7, ref: 'pitch', label: 'Authenticité de l\'émotion (pas d\'exagération)' },
      no_special_effects: { min: 0.9, ref: 'none', label: 'Absence d\'effets spéciaux fantaisistes' },
    }), type: 'json', category: 'validation' },

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
      badgeText: null,
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
  // SCENE TYPES
  // ============================================

  const sceneTypes = [
    {
      code: 'ACTION',
      mode: 'all',
      description: 'Le personnage FAIT quelque chose de visible et dynamique',
      minRatio: 0.5,
      maxRatio: 0.7,
      examples: ['marche', 'travaille', 'cuisine', 'joue musique', 'écrit'],
      position: null,
      allowsCameraLook: false,
      displayOrder: 0,
    },
    {
      code: 'INTERACTION',
      mode: 'all',
      description: 'Échange avec quelqu\'un (Character B, animal, commerçant)',
      minRatio: 0,
      maxRatio: 0.3,
      examples: ['discussion', 'collaboration', 'moment partagé'],
      position: null,
      allowsCameraLook: false,
      displayOrder: 1,
    },
    {
      code: 'IMMERSION',
      mode: 'all',
      description: 'Découverte d\'un lieu, absorption dans l\'environnement',
      minRatio: 0,
      maxRatio: 0.3,
      examples: ['arrive dans un lieu', 'observe paysage', 'explore'],
      position: null,
      allowsCameraLook: false,
      displayOrder: 2,
    },
    {
      code: 'INTROSPECTION',
      mode: 'all',
      description: 'Moment de réflexion, contemplation (à utiliser avec modération)',
      minRatio: 0,
      maxRatio: 0.2,
      examples: ['contemple', 'réfléchit', 'apprécie'],
      position: null,
      allowsCameraLook: false,
      displayOrder: 3,
    },
    {
      code: 'ACCOMPLISSEMENT',
      mode: 'all',
      description: 'Réservé à la scène finale - le personnage a réalisé son rêve',
      minRatio: 0,
      maxRatio: 1,
      examples: ['satisfaction', 'fierté', 'regard caméra possible'],
      position: null,
      allowsCameraLook: true,
      displayOrder: 4,
    },
    {
      code: 'TRANSITION_AWAKENING',
      mode: 'scenario_pub',
      description: 'Le quotidien ennuyeux se transforme en environnement de rêve. Le personnage passe de la lassitude à l\'émerveillement.',
      minRatio: 0,
      maxRatio: 1,
      examples: ['bureau gris → atelier lumineux', 'file d\'attente → plage dorée'],
      position: '1A',
      allowsCameraLook: false,
      displayOrder: 5,
    },
    {
      code: 'TRANSITION_ACTION',
      mode: 'scenario_pub',
      description: 'Suite immédiate de l\'éveil : le personnage commence à explorer le monde de rêve.',
      minRatio: 0,
      maxRatio: 1,
      examples: ['premier pas dans le rêve', 'découverte émerveillée de l\'environnement'],
      position: '1B',
      allowsCameraLook: false,
      displayOrder: 6,
    },
  ];

  for (const st of sceneTypes) {
    await prisma.sceneType.upsert({
      where: { code_mode: { code: st.code, mode: st.mode } },
      update: { ...st },
      create: { ...st },
    });
  }
  console.log('✅ Scene types seeded');

  // ============================================
  // PROMPT TEMPLATES
  // ============================================

  // Read prompt templates from Python templates file
  const templatesPath = path.resolve(__dirname, '../../generation/prompts/templates.py');
  let promptTemplates: { code: string; name: string; description: string; template: string; category: string }[] = [];

  if (fs.existsSync(templatesPath)) {
    const content = fs.readFileSync(templatesPath, 'utf-8');

    // Extract each PROMPT_* variable
    const promptDefs: { varName: string; code: string; name: string; description: string; category: string }[] = [
      { varName: 'PROMPT_ANALYZE_CHARACTER', code: 'ANALYZE_CHARACTER', name: 'Analyse personnage', description: 'Analyse les caractéristiques physiques du personnage depuis la photo', category: 'generation' },
      { varName: 'PROMPT_EXTRACT_DREAM_ELEMENTS', code: 'EXTRACT_DREAM_ELEMENTS', name: 'Extraction éléments du rêve', description: 'Extrait et priorise les éléments du rêve de l\'utilisateur', category: 'generation' },
      { varName: 'PROMPT_GENERATE_PALETTE', code: 'GENERATE_PALETTE', name: 'Génération palette couleurs', description: 'Crée une palette de 4 couleurs adaptée au rêve', category: 'generation' },
      { varName: 'PROMPT_SCENE_PALETTE', code: 'SCENE_PALETTE', name: 'Palette par scène', description: 'Décline la palette principale pour une scène spécifique', category: 'generation' },
      { varName: 'PROMPT_SCENARIO_GLOBAL', code: 'SCENARIO_GLOBAL', name: 'Scénario global', description: 'Génère le scénario complet avec distribution des scènes', category: 'generation' },
      { varName: 'PROMPT_FREE_SCENES', code: 'FREE_SCENES', name: 'Scènes libres', description: 'Génère les scènes en mode free_scenes', category: 'generation' },
      { varName: 'PROMPT_SCENARIO_VIDEO', code: 'SCENARIO_VIDEO', name: 'Scénario vidéo par scène', description: 'Génère les keyframes start/end pour une scène vidéo', category: 'generation' },
      { varName: 'PROMPT_SCENARIO_VIDEO_POV', code: 'SCENARIO_VIDEO_POV', name: 'Scénario vidéo POV', description: 'Génère les keyframes pour une scène POV (vue subjective)', category: 'generation' },
      { varName: 'PROMPT_IMAGE_GENERATE', code: 'IMAGE_GENERATE', name: 'Génération image', description: 'Prompt principal pour la génération d\'images avec préservation du visage', category: 'generation' },
      { varName: 'PROMPT_IMAGE_SAME_DAY_RULES', code: 'IMAGE_SAME_DAY_RULES', name: 'Règles même journée', description: 'Règles de continuité vestimentaire pour les scènes d\'une même journée', category: 'generation' },
      { varName: 'PROMPT_IMAGE_POV', code: 'IMAGE_POV', name: 'Image POV', description: 'Génération d\'image en vue subjective (pas de personnage visible)', category: 'generation' },
      { varName: 'PROMPT_VALIDATION', code: 'VALIDATION', name: 'Validation image', description: 'Compare l\'image générée avec la référence selon des critères stricts', category: 'validation' },
      { varName: 'PROMPT_VIDEO', code: 'VIDEO', name: 'Vidéo transition', description: 'Prompt pour la génération vidéo entre deux keyframes', category: 'video' },
      { varName: 'PROMPT_SCENARIO_PUB_VIDEO_1A', code: 'SCENARIO_PUB_VIDEO_1A', name: 'Spot pub scène 1A', description: 'Transition quotidien → rêve pour le mode scenario_pub', category: 'generation' },
      { varName: 'PROMPT_SCENARIO_PUB_VIDEO_1B', code: 'SCENARIO_PUB_VIDEO_1B', name: 'Spot pub scène 1B', description: 'Premiers pas dans le rêve pour le mode scenario_pub', category: 'generation' },
      { varName: 'PROMPT_SCENARIO_PUB', code: 'SCENARIO_PUB', name: 'Scénario pub complet', description: 'Scénario complet pour le mode spot publicitaire', category: 'generation' },
      { varName: 'PROMPT_VIDEO_POV', code: 'VIDEO_POV', name: 'Vidéo POV', description: 'Prompt vidéo pour les scènes en vue subjective', category: 'video' },
    ];

    for (const def of promptDefs) {
      // Extract the template content between triple quotes
      // Pattern: VARNAME = """content""" or VARNAME = """{prefix}...{suffix}"""
      const regex = new RegExp(`${def.varName}\\s*=\\s*"""([\\s\\S]*?)"""`, 'm');
      const match = content.match(regex);
      if (match) {
        promptTemplates.push({
          code: def.code,
          name: def.name,
          description: def.description,
          template: match[1].trim(),
          category: def.category,
        });
      }
    }
  } else {
    console.log('⚠️  Templates file not found, seeding with placeholders');
  }

  for (const pt of promptTemplates) {
    await prisma.promptTemplate.upsert({
      where: { code: pt.code },
      update: { name: pt.name, description: pt.description, template: pt.template, category: pt.category },
      create: { ...pt },
    });
  }
  console.log(`✅ Prompt templates seeded: ${promptTemplates.length} entries`);

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
