import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { id: '1' },
      include: {
        preferences: true,
        gear: true,
      },
    });
    
    if (user) {
      console.log('✅ User found:', user.name, user.email);
      console.log('✅ Has preferences:', !!user.preferences);
      console.log('✅ Gear count:', user.gear?.length || 0);
    } else {
      console.log('❌ No user with ID "1" found');
      console.log('💡 Run: yarn prisma db seed');
    }
    
    const challenges = await prisma.dailyChallenge.findMany({
      where: { userId: '1', status: 'pending' },
    });
    console.log('📋 Pending challenges:', challenges.length);
    if (challenges.length > 0) {
      console.log('Last challenge:', challenges[0].challengeText.substring(0, 50) + '...');
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
