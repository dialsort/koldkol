import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

// Load .env.local first (mirrors Next.js precedence)
dotenv.config({ path: ".env.local" });
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Demo account
  const account = await prisma.account.upsert({
    where: { id: "demo-account" },
    update: {},
    create: {
      id: "demo-account",
      name: "Compte Démo",
      plan: "ESSENTIEL",
    },
  });

  // Demo admin user
  await prisma.user.upsert({
    where: { email: "admin@dialsort.demo" },
    update: { emailVerified: true },
    create: {
      email: "admin@dialsort.demo",
      hashedPassword: await bcrypt.hash("demo1234", 12),
      accountId: account.id,
      role: "ADMIN",
      emailVerified: true,
    },
  });

  const systemDispositions = [
    { label: "Ne plus appeler", behavior: "DO_NOT_CALL" as const },
    { label: "À rappeler", behavior: "CALLBACK" as const },
    { label: "Répondeur", behavior: "VOICEMAIL" as const },
  ];

  for (const d of systemDispositions) {
    await prisma.disposition.upsert({
      where: { id: `${account.id}-system-${d.behavior.toLowerCase()}` },
      update: {},
      create: {
        id: `${account.id}-system-${d.behavior.toLowerCase()}`,
        accountId: account.id,
        label: d.label,
        kind: "SYSTEM",
        behavior: d.behavior,
      },
    });
  }

  console.log(`Seed done — account: ${account.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
