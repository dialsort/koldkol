import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://koldkol.com";

export const viewport: Viewport = {
  themeColor: "#dc2626",
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "KoldKol — Triez vos prospects intelligemment",
    template: "%s | KoldKol",
  },
  description:
    "KoldKol est le logiciel de cold calling qui trie automatiquement vos prospects : détection répondeur, créneaux optimisés, analytics en temps réel. Essayez gratuitement.",
  keywords: [
    "cold calling",
    "prospection téléphonique",
    "logiciel de phoning",
    "détection répondeur",
    "campagne d'appels",
    "prospection commerciale",
    "CRM appels",
    "auto-dialer",
    "predictive dialer",
    "KoldKol",
  ],
  authors: [{ name: "KoldKol", url: APP_URL }],
  creator: "KoldKol",
  publisher: "KoldKol",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: APP_URL,
    siteName: "KoldKol",
    title: "KoldKol — Triez vos prospects intelligemment",
    description:
      "Identifiez automatiquement les contacts joignables. Détection répondeur, créneaux optimisés, analytics en temps réel.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "KoldKol — Logiciel de cold calling intelligent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KoldKol — Triez vos prospects intelligemment",
    description:
      "Identifiez automatiquement les contacts joignables. Détection répondeur, créneaux optimisés, analytics en temps réel.",
    images: ["/og-image.png"],
    creator: "@koldkol",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "1254x1254" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "1254x1254" }],
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: APP_URL,
    languages: {
      "fr-FR": APP_URL,
    },
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50">{children}</body>
    </html>
  );
}
