import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    // Standard email + password login
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            hashedPassword: true,
            accountId: true,
            role: true,
            emailVerified: true,
          },
        });

        if (!user) return null;
        if (!user.emailVerified) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.hashedPassword);
        if (!valid) return null;

        return { id: user.id, email: user.email, accountId: user.accountId, role: user.role };
      },
    }),

    // One-time verification-token login (called after email link click)
    CredentialsProvider({
      id: "email-token",
      name: "email-token",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(credentials) {
        if (!credentials?.token) return null;

        const user = await prisma.user.findUnique({
          where: { verificationToken: credentials.token as string },
          select: {
            id: true,
            email: true,
            accountId: true,
            role: true,
            verificationTokenExpiry: true,
          },
        });

        if (!user || !user.verificationTokenExpiry) return null;
        if (user.verificationTokenExpiry < new Date()) return null;

        // Mark verified and clear the token atomically
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            verificationToken: null,
            verificationTokenExpiry: null,
          },
        });

        return { id: user.id, email: user.email, accountId: user.accountId, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const u = user as { accountId?: string; role?: string };
        token.accountId = u.accountId;
        token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = session.user as any;
      if (token?.accountId) u.accountId = token.accountId;
      if (token?.role) u.role = token.role;
      return session;
    },
  },
});
