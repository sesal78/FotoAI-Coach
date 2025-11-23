require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking database...\n');
  
  // Check users
  const users = await prisma.user.findMany({
    include: { preferences: true, gear: true }
  });
  
  console.log(`📊 Total users: ${users.length}`);
  users.forEach(u => {
    console.log(`  - ID: "${u.id}", Email: ${u.email}, Name: ${u.name}`);
  });
  
  // Check challenges for user ID '1'
  const challenges = await prisma.dailyChallenge.findMany({
    where: { userId: '1' },
    orderBy: { issuedDate: 'desc' },
    take: 10,
  });
  
  console.log(`\n📋 Challenges for userId="1": ${challenges.length}`);
  challenges.forEach((ch, i) => {
    console.log(`  ${i+1}. ${ch.status} - ${ch.category} - ${new Date(ch.issuedDate).toLocaleDateString()}`);
  });
  
  // Check all challenges
  const allChallenges = await prisma.dailyChallenge.findMany({
    orderBy: { issuedDate: 'desc' },
    take: 10,
  });
  
  console.log(`\n📋 All challenges in database: ${allChallenges.length}`);
  allChallenges.forEach((ch, i) => {
    console.log(`  ${i+1}. UserID: "${ch.userId}", Status: ${ch.status}, Category: ${ch.category}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
