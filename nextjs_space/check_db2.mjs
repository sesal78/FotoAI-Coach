import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

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
      console.log('💡 Need to run: yarn prisma db seed');
    }
    
    const allChallenges = await prisma.dailyChallenge.findMany({
      where: { userId: '1' },
      orderBy: { issuedDate: 'desc' },
      take: 5,
    });
    
    const pendingChallenges = allChallenges.filter(c => c.status === 'pending');
    
    console.log('📊 Total challenges:', allChallenges.length);
    console.log('📋 Pending challenges:', pendingChallenges.length);
    
    if (pendingChallenges.length > 0) {
      console.log('\n💡 Latest pending challenge:');
      console.log('  Category:', pendingChallenges[0].category);
      console.log('  Text:', pendingChallenges[0].challengeText.substring(0, 80) + '...');
      console.log('  Issued:', pendingChallenges[0].issuedDate.toLocaleDateString());
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    if (error.code === 'P2021') {
      console.log('💡 Table does not exist. Run: yarn prisma db push');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
