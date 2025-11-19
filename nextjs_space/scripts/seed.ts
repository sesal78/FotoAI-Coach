
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database for Foto AI Agent...');

  // Create Seun's user account
  const user = await prisma.user.upsert({
    where: { id: '1' },
    update: {},
    create: {
      id: '1',
      email: 'seun@example.com',
      password: '$2a$10$placeholder', // This would be hashed in production
      name: 'Seun',
      timezone: 'America/Los_Angeles',
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Create Seun's preferences (based on his profile)
  const preferences = await prisma.userPreferences.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      workStartTime: '09:00',
      workEndTime: '17:00',
      lunchStartTime: '12:00',
      lunchEndTime: '13:00',
      primaryPhotoDay: 'Saturday',
      secondaryPhotoDays: ['Sunday'],
      lunchBreakPhotography: true,
      eveningPhotography: true,
      wfhFlexibility: true,
      skillLevel: 'intermediate',
      photographyInterests: ['street', 'portrait', 'architecture', 'film photography', 'urban exploration'],
      avoidsStyles: [],
      saturdayComplexity: 'high',
      weekdayComplexity: 'micro',
      adaptToWeather: true,
      adaptToCalendar: true,
      saturdayNotifTime: '07:00',
      saturdayNotifChannels: ['email'],
      weekdayNotifTime: '11:30',
      weekdayNotifChannels: ['email'],
      eveningAlertsEnabled: true,
      wfhNotifTime: '09:00',
      homeLocation: 'San Francisco, CA',
      currentLocation: 'San Francisco, CA',
    },
  });

  console.log('✅ Created user preferences');

  // Create Seun's gear inventory
  const gearItems = [
    {
      category: 'camera',
      brand: 'Fujifilm',
      model: 'X-T5',
      specs: JSON.stringify({
        sensor: 'APS-C 40.2MP',
        type: 'Mirrorless',
        features: ['5-axis IBIS', '4K 60fps', 'Film Simulations'],
      }),
      isPrimary: true,
    },
    {
      category: 'camera',
      brand: 'Ricoh',
      model: 'GR IIIx',
      specs: JSON.stringify({
        sensor: 'APS-C 24.2MP',
        lens: '40mm f/2.8 equivalent',
        type: 'Compact',
      }),
      isPrimary: false,
    },
    {
      category: 'camera',
      brand: 'Nikon',
      model: 'FE2',
      specs: JSON.stringify({
        type: 'Film SLR',
        year: '1983',
        features: ['Manual focus', 'Mechanical shutter'],
      }),
      isPrimary: false,
    },
    {
      category: 'camera',
      brand: 'Pentax',
      model: 'ME',
      specs: JSON.stringify({
        type: 'Film SLR',
        year: '1976',
        features: ['Compact', 'Aperture priority'],
      }),
      isPrimary: false,
    },
  ];

  for (const gearItem of gearItems) {
    await prisma.userGear.upsert({
      where: {
        userId_brand_model: {
          userId: user.id,
          brand: gearItem.brand,
          model: gearItem.model,
        },
      },
      update: {},
      create: {
        userId: user.id,
        ...gearItem,
      },
    });
  }

  console.log(`✅ Created ${gearItems.length} gear items`);

  // Initialize user progress
  const progress = await prisma.userProgress.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      totalChallengesIssued: 0,
      totalChallengesCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      favoriteSubjects: [],
      improvementAreas: [],
    },
  });

  console.log('✅ Initialized user progress');

  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📋 Seun\'s Profile Summary:');
  console.log(`   Email: ${user.email}`);
  console.log(`   Gear: ${gearItems.length} items`);
  console.log(`   Primary Camera: Fujifilm X-T5`);
  console.log(`   Skills: ${preferences.skillLevel}`);
  console.log(`   Interests: ${preferences.photographyInterests.join(', ')}`);
  console.log(`   Primary Photo Day: ${preferences.primaryPhotoDay}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
