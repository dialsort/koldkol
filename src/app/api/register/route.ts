import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, verificationEmailHtml } from "@/lib/email";
import { z } from "zod";
import type { DispositionBehavior } from "@/types";

const passwordSchema = z
  .string()
  .min(8, "8 caractères minimum")
  .regex(/[A-Z]/, "Une majuscule requise")
  .regex(/[a-z]/, "Une minuscule requise")
  .regex(/\d/, "Un chiffre requis")
  .regex(/[^A-Za-z0-9]/, "Un caractère spécial requis");

const schema = z.object({
  accountName: z.string().min(2).max(100),
  email: z.string().email(),
  password: passwordSchema,
});

const SYSTEM_DISPOSITIONS: { label: string; behavior: DispositionBehavior }[] = [
  { label: "Ne plus appeler", behavior: "DO_NOT_CALL" },
  { label: "À rappeler", behavior: "CALLBACK" },
  { label: "Répondeur", behavior: "VOICEMAIL" },
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const { accountName, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: { name: accountName },
      });

      await tx.user.create({
        data: {
          email,
          hashedPassword,
          accountId: account.id,
          role: "ADMIN",
          emailVerified: false,
          verificationToken,
          verificationTokenExpiry,
        },
      });

      for (const d of SYSTEM_DISPOSITIONS) {
        await tx.disposition.create({
          data: {
            accountId: account.id,
            label: d.label,
            kind: "SYSTEM",
            behavior: d.behavior,
          },
        });
      }
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
    const verifyUrl = `${appUrl}/api/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: email,
      subject: "Vérifiez votre adresse email — KoldKol",
      html: verificationEmailHtml(verifyUrl, accountName),
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[register] error:", err);
    return NextResponse.json(
      { error: "Erreur serveur lors de la création du compte" },
      { status: 500 },
    );
  }
}
