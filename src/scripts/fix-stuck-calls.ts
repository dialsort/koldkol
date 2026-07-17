import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const stuck = await prisma.callAttempt.findMany({
    where: { result: null },
    select: { id: true, accountId: true, startedAt: true },
  });

  console.log(`Found ${stuck.length} stuck call attempt(s)`);

  if (stuck.length === 0) { await prisma.$disconnect(); return; }

  const updated = await prisma.callAttempt.updateMany({
    where: { result: null },
    data: { result: "FAILED" },
  });

  console.log(`Marked ${updated.count} call(s) as FAILED`);
  await prisma.$disconnect();
}

main().catch(console.error);
