import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/landing-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KoldKol",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://koldkol.com",
  description:
    "KoldKol est un logiciel de cold calling SaaS qui trie automatiquement vos prospects : détection répondeur (AMD), créneaux horaires optimisés, analytics en temps réel et import CSV.",
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "59",
      priceCurrency: "EUR",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "59",
        priceCurrency: "EUR",
        billingDuration: "P1M",
      },
    },
    {
      "@type": "Offer",
      name: "Growth",
      price: "119",
      priceCurrency: "EUR",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "119",
        priceCurrency: "EUR",
        billingDuration: "P1M",
      },
    },
    {
      "@type": "Offer",
      name: "Scale",
      price: "227",
      priceCurrency: "EUR",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "227",
        priceCurrency: "EUR",
        billingDuration: "P1M",
      },
    },
  ],
  featureList: [
    "Détection automatique des répondeurs (AMD)",
    "Créneaux horaires configurables",
    "Import et export CSV",
    "Analytics et heatmap des appels",
    "Softphone intégré (Twilio)",
    "Multi-campagnes",
    "Conforme RGPD",
  ],
  inLanguage: "fr",
  availableLanguage: "French",
  provider: {
    "@type": "Organization",
    name: "KoldKol",
    url: "https://koldkol.com",
  },
};

export default async function Home() {
  const session = await auth();
  if (session) redirect("/app");
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
