import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// .env.local overrides .env (mirrors Next.js precedence)
dotenv.config({ path: ".env.local" });
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL = session pooler (port 5432) — required for migrations (no pgbouncer)
    // DATABASE_URL = transaction pooler (port 6543) — used by PrismaClient at runtime
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
