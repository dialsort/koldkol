import { type NextRequest, NextResponse } from "next/server";
import { signIn } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

  if (!token) {
    return NextResponse.redirect(`${appUrl}/verify-email?error=missing`);
  }

  try {
    // signIn("email-token") verifies + marks emailVerified + clears token, then redirects
    await signIn("email-token", { token, redirectTo: "/app/onboarding" });
  } catch (err: unknown) {
    // NextAuth throws a Redirect internally on success — let it bubble
    const isRedirect =
      err instanceof Error &&
      (err.message === "NEXT_REDIRECT" || err.constructor?.name === "UnauthenticatedError" === false);

    // Re-throw if it looks like a redirect (Next.js catches it)
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest: string }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }

    console.error("[verify-email] error:", err, isRedirect);
    return NextResponse.redirect(`${appUrl}/verify-email?error=invalid`);
  }

  // signIn with redirectTo never reaches here, but just in case:
  return NextResponse.redirect(`${appUrl}/app`);
}
