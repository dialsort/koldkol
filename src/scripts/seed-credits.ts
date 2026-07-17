import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const accounts = await prisma.account.findMany({ select: { id: true, name: true } });
  console.log("Accounts found:", accounts.length);

  for (const account of accounts) {
    const agg = await prisma.creditLedger.aggregate({
      where: { accountId: account.id },
      _sum: { delta: true },
    });
    const current = agg._sum.delta ?? 0;
    console.log(`${account.name} (${account.id}): ${current} credits`);

    if (current < 100) {
      await prisma.creditLedger.create({
        data: { accountId: account.id, delta: 500, reason: "INITIAL_CREDIT" },
      });
      console.log(`  → Added 500 credits`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
