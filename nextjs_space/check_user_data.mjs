import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking database for user data...\n');
  
  // Check users
  const users = await prisma.user.findMany({
    include: {
      preferences: true,
      gear: true,
    }
  });
  
  console.log(`📊 Found ${users.length} users:`);
  users.forEach(user => {
    console.log(`  - ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);
  });
  console.log('');
  
  // Check challenges for user '1'
  const challenges = await prisma.dailyChallenge.findMany({
    where: { userId: '1' },
    orderBy: { issuedDate: 'desc' },
    take: 5,
  });
  
  console.log(`📋 Challenges for user ID '1': ${challenges.length}`);
  challenges.forEach((ch, idx) => {
    console.log(`  ${idx + 1}. ${ch.status} - ${ch.category} (${new Date(ch.issuedDate).toLocaleString()})`);
    console.log(`     ${ch.challengeText.substring(0, 80)}...`);
  });
  
  // Check for any challenge
  const anyChallenges = await prisma.dailyChallenge.findMany({
    orderBy: { issuedDate: 'desc' },
    take: 5,
  });
  
  console.log(`\n📋 All challenges in database: ${anyChallenges.length}`);
  anyChallenges.forEach((ch, idx) => {
    console.log(`  ${idx + 1}. UserID: ${ch.userId}, Status: ${ch.status}, Category: ${ch.category}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
