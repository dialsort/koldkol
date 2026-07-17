"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { DaySlotRow, ResultCount, SlotRate } from "@/lib/dashboard";

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid #fee2e2",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  fontSize: 12,
};

// ── Slot answer-rate bar chart ─────────────────────────────────────────────

const SLOT_COLOR: Record<string, string> = {
  MATIN: "#dc1c2e",
  DEBUT_APREM: "#f87171",
  FIN_APREM: "#fca5a5",
};

export function SlotRateChart({ rates }: { rates: SlotRate[] }) {
  const data = rates.map((r) => ({ name: r.short, rate: r.ratePct, slot: r.slot }));
  return (
    <ResponsiveContainer width="100%" height={220}>
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
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="rate" radius={[5, 5, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.slot} fill={SLOT_COLOR[d.slot] ?? "#dc1c2e"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Day × slot grouped bar chart ──────────────────────────────────────────

export function DaySlotChart({ rows }: { rows: DaySlotRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
        <XAxis
          dataKey="day"
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
          formatter={(v: unknown) => `${v as number}%`}
          cursor={{ fill: "#fef2f2" }}
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              MATIN: "Matin",
              DEBUT_APREM: "Déb. ap.-midi",
              FIN_APREM: "Fin ap.-midi",
            };
            return labels[value] ?? value;
          }}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="MATIN" fill={SLOT_COLOR.MATIN} radius={[3, 3, 0, 0]} />
        <Bar dataKey="DEBUT_APREM" fill={SLOT_COLOR.DEBUT_APREM} radius={[3, 3, 0, 0]} />
        <Bar dataKey="FIN_APREM" fill={SLOT_COLOR.FIN_APREM} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Result distribution pie chart ─────────────────────────────────────────

const RESULT_COLOR: Record<string, string> = {
  HUMAN_ANSWERED: "#dc1c2e",
  ANSWERED_NOT_TAKEN: "#f87171",
  VOICEMAIL: "#fca5a5",
  NO_ANSWER: "#d1d5db",
  FAILED: "#9ca3af",
};

export function ResultPieChart({ results }: { results: ResultCount[] }) {
  const total = results.reduce((s, r) => s + r.count, 0);
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <ResponsiveContainer width={200} height={200}>
        <PieChart>
          <Pie
            data={results}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={46}
            strokeWidth={2}
            stroke="#fff"
          >
            {results.map((r) => (
              <Cell key={r.result} fill={RESULT_COLOR[r.result] ?? "#dc1c2e"} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: unknown) => {
              const n = v as number;
              return [`${n} (${Math.round((n / total) * 100)}%)`, ""];
            }}
            contentStyle={TOOLTIP_STYLE}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-2.5 flex-1 min-w-[160px]">
        {results.map((r) => (
          <div key={r.result} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: RESULT_COLOR[r.result] ?? "#dc1c2e" }}
              />
              <span className="text-gray-700">{r.label}</span>
            </div>
            <div className="flex items-center gap-2.5 text-right">
              <span className="font-semibold text-gray-900 tabular-nums">{r.count}</span>
              <span className="text-gray-400 w-10 text-xs tabular-nums">
                {Math.round((r.count / total) * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
