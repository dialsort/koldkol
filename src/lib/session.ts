import { auth } from "@/lib/auth";
import type { UserRole } from "@/types";

export type SessionContext = {
  accountId: string;
  userId: string;
  role: UserRole;
};

// ─── Tenant isolation rule ────────────────────────────────────────────────────
//
// RULE: Every Prisma query that touches business data MUST include
//   `accountId: ctx.accountId`
// as a top-level filter. Cross-tenant queries are forbidden regardless of the
// caller's intent. Always obtain accountId from getCurrentAccount() or
// requireAccount() — never trust a client-supplied accountId.
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the authenticated account context, or null if there is no active session.
 * Use in API Route Handlers where you want to return a 401 manually.
 */
export async function getCurrentAccount(): Promise<SessionContext | null> {
  const session = await auth();
  const user = session?.user as { id?: string; accountId?: string; role?: UserRole } | undefined;

  if (!user?.id || !user?.accountId) return null;

  return {
    accountId: user.accountId,
    userId: user.id,
    role: user.role ?? "AGENT",
  };
}

/**
 * Like getCurrentAccount() but throws if there is no active session.
 * Use in Server Components and Server Actions where a redirect is acceptable.
 * In API Route Handlers, prefer getCurrentAccount() and return NextResponse 401.
 */
export async function requireAccount(): Promise<SessionContext> {
  const ctx = await getCurrentAccount();
  if (!ctx) throw new Error("Unauthorized");
  return ctx;
}
