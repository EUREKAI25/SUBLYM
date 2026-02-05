import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create some test access codes
  const accessCodes = [
    { code: 'DEMO-TEST-001', source: 'direct', maxActivations: 10 },
    { code: 'ETSY-LAUNCH-01', source: 'etsy', maxActivations: 100 },
    { code: 'PARTNER-VIP-01', source: 'partner', maxActivations: 5 },
  ];

  for (const ac of accessCodes) {
    await prisma.accessCode.upsert({
      where: { code: ac.code },
      update: {},
      create: {
        code: ac.code,
        source: ac.source,
        maxActivations: ac.maxActivations,
        status: 'valid',
      },
    });
    console.log(`  ✓ AccessCode: ${ac.code}`);
  }

  // Create default config values
  const configs = [
    { key: 'max_user_photos', value: '6', type: 'number', category: 'limits' },
    { key: 'max_free_generations', value: '1', type: 'number', category: 'limits' },
    { key: 'session_expiry_days', value: '30', type: 'number', category: 'security' },
    { key: 'pin_length', value: '6', type: 'number', category: 'security' },
  ];

  for (const config of configs) {
    await prisma.config.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
    console.log(`  ✓ Config: ${config.key} = ${config.value}`);
  }

  // Create a test user (optional, for development)
  if (process.env.NODE_ENV === 'development') {
    const testPinHash = await bcrypt.hash('123456', 10);
    const testUser = await prisma.user.upsert({
      where: { id: 'test-user-dev-001' },
      update: {},
      create: {
        id: 'test-user-dev-001',
        pinHash: testPinHash,
        navigationMode: 'scroll',
        useDreamTheme: true,
        themePreference: 'system',
      },
    });
    console.log(`  ✓ Test user: ${testUser.id} (PIN: 123456)`);

    // Create a test dream for the test user
    const testDream = await prisma.dream.upsert({
      where: { id: 'test-dream-dev-001' },
      update: {},
      create: {
        id: 'test-dream-dev-001',
        userId: testUser.id,
        title: 'Mon premier rêve',
        description: 'Je vis ma vie idéale, entouré(e) d\'amour et de réussite...',
        status: 'active',
        isActive: true,
      },
    });
    console.log(`  ✓ Test dream: ${testDream.id}`);
  }

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
