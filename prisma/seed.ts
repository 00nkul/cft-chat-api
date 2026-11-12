import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const names = ['Alice', 'Bob', 'Carol'];

  for (const name of names) {
    const email = `${name.toLowerCase()}@example.com`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name, email },
    });
    console.log(`${user.name.padEnd(6)} -> ${user.id}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
