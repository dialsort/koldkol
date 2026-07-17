import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, verificationEmailHtml } from "@/lib/email";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, emailVerified: true, account: { select: { name: true } } },
    });

    // Return 200 even if user not found — don't leak existence
    if (!user || user.emailVerified) {
      return NextResponse.json({ ok: true });
    }

    const verificationToken = randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpiry },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
    const verifyUrl = `${appUrl}/api/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: parsed.data.email,
      subject: "Vérifiez votre adresse email — KoldKol",
      html: verificationEmailHtml(verifyUrl, user.account.name),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[resend-verification] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
