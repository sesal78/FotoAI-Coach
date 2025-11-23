require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const challenge = await prisma.dailyChallenge.findFirst({
    where: { userId: '1', status: 'pending' },
    orderBy: { issuedDate: 'desc' },
  });
  
  if (challenge) {
    console.log('📋 Challenge Details:\n');
    console.log('ID:', challenge.id);
    console.log('Status:', challenge.status);
    console.log('Category:', challenge.category);
    console.log('Difficulty:', challenge.difficulty);
    console.log('Duration:', challenge.duration);
    console.log('Location:', challenge.location);
    console.log('Weather:', challenge.weatherConditions);
    console.log('Tips:', challenge.tips);
    console.log('Recommended Gear:', challenge.recommendedGear);
    console.log('\nChallenge Text:');
    console.log(challenge.challengeText);
    console.log('\nIssued Date:', challenge.issuedDate);
  } else {
    console.log('No pending challenge found for user 1');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
