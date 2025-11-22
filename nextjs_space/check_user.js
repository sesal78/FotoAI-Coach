require('dotenv').config();
const { PrismaClient } = require('.prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      preferences: true,
      gear: true
    }
  });
  console.log('\n✅ Users found:', users.length);
  users.forEach(u => {
    console.log(`\n- ID: ${u.id}`);
    console.log(`  Email: ${u.email}`);
    console.log(`  Name: ${u.name}`);
    console.log(`  Preferences: ${u.preferences ? 'YES' : 'NO'}`);
    console.log(`  Gear: ${u.gear ? u.gear.length : 0} items`);
  });
  
  if (users.length === 0) {
    console.log('\n❌ NO USERS FOUND! Need to seed database.');
  }
}

main()
  .catch(e => {
    console.error('Error:', e.message);
  })
  .finally(() => prisma.$disconnect());
