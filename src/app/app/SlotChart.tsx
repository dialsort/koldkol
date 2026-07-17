"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { SlotRate } from "@/lib/dashboard";

interface Props {
  rates: SlotRate[];
}

const SLOT_COLOR: Record<string, string> = {
  MATIN: "#dc1c2e",
  DEBUT_APREM: "#f87171",
  FIN_APREM: "#fca5a5",
};

export default function SlotChart({ rates }: Props) {
  const data = rates.map((r) => ({ name: r.short, rate: r.ratePct, slot: r.slot }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          formatter={(v: unknown) => [`${v as number}%`, "Taux de décroché"]}
          cursor={{ fill: "#fef2f2" }}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid #fee2e2",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="rate" radius={[5, 5, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.slot} fill={SLOT_COLOR[entry.slot] ?? "#dc1c2e"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
