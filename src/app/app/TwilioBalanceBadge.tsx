"use client";

import { useState, useEffect, useCallback } from "react";

export default function TwilioBalanceBadge() {
  const [balance, setBalance] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/twilio/balance");
      if (!res.ok) return;
      const data = (await res.json()) as { balance: string | null; currency: string };
      setBalance(data.balance);
      setCurrency(data.currency ?? "USD");
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance]);

  if (loading) return null;
  if (balance === null) return null;

  const amount = parseFloat(balance);
  const low = amount < 5;
  const formatted = amount.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <button
      onClick={() => void fetchBalance()}
      title="Solde Twilio — cliquer pour rafraîchir"
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
        low
          ? "border-orange-200 bg-orange-50 text-orange-600"
          : "border-gray-100 bg-gray-50 text-gray-500"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${low ? "bg-orange-400" : "bg-blue-400"}`} />
      Twilio {formatted}
    </button>
  );
}
