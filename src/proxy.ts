import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes accessible without a session.
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/logout",
  "/register", // legacy alias — kept until old pages are cleaned up
  "/api/auth",
  "/api/webhooks",
  "/api/register",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Landing page and explicitly public routes bypass auth.
  if (pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sample-import.csv|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf)).*)"],
};
