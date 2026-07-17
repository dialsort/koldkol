"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV = [
  { href: "/app", label: "Dashboard", exact: true },
  { href: "/app/campaigns", label: "Campagnes" },
  { href: "/app/prospects", label: "Prospects" },
  { href: "/app/session", label: "Session" },
  { href: "/app/stats", label: "Stats" },
  { href: "/app/twilio", label: "Twilio" },
  { href: "/app/billing", label: "Facturation" },
];

export default function NavLinks() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const activeIdx = NAV.findIndex(({ href, exact }) =>
      exact ? pathname === href : pathname.startsWith(href)
    );
    const el = linkRefs.current[activeIdx];
    const nav = navRef.current;
    if (!el || !nav) { setPill(null); return; }
    const eRect = el.getBoundingClientRect();
    const nRect = nav.getBoundingClientRect();
    setPill({ left: eRect.left - nRect.left, width: eRect.width });
  }, [pathname, mounted]);

  return (
    <nav ref={navRef} className="relative hidden sm:flex items-center gap-1 flex-1">
      {/* Sliding pill */}
      {pill && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 rounded-lg bg-red-50 border border-red-100"
          style={{
            left: pill.left,
            width: pill.width,
            transition: mounted ? "left 220ms cubic-bezier(0.4,0,0.2,1), width 220ms cubic-bezier(0.4,0,0.2,1)" : "none",
          }}
        />
      )}

      {NAV.map(({ href, label, exact }, i) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            ref={(el) => { linkRefs.current[i] = el; }}
            className={`relative z-10 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
              isActive ? "text-red-700" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
