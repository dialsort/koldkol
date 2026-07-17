"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/app", label: "Dashboard", exact: true },
  { href: "/app/session", label: "Session" },
  { href: "/app/prospects", label: "Prospects" },
  { href: "/app/stats", label: "Stats" },
  { href: "/app/twilio", label: "Twilio" },
  { href: "/app/credits", label: "Crédits" },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5">
      {NAV.map((n) => {
        const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`relative px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              active ? "text-red-600" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/80"
            }`}
          >
            {n.label}
            {active && (
              <span
                className="absolute bottom-0.5 left-3 right-3 h-0.5 rounded-full bg-red-500"
                style={{ animation: "fade-in 0.25s ease" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
