// @ts-nocheck — pending rewrite (schema migration lot 2)
"use client";

import type { CallAttempt } from "@/types";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

type Cell = { day: number; hour: number; answered: number; total: number };

function buildHeatmap(attempts: CallAttempt[]): Map<string, Cell> {
  const map = new Map<string, Cell>();

  for (const a of attempts) {
    const d = new Date(a.calledAt);
    const day = (d.getDay() + 6) % 7; // 0=Mon
    const hour = d.getHours();
    const key = `${day}-${hour}`;
    const cell = map.get(key) ?? { day, hour, answered: 0, total: 0 };
    cell.total++;
    if (a.status === "ANSWERED") cell.answered++;
    map.set(key, cell);
  }

  return map;
}

function heatColor(rate: number, total: number): string {
  if (total === 0) return "bg-gray-100";
  if (rate >= 0.6) return "bg-green-500 text-white";
  if (rate >= 0.4) return "bg-green-300";
  if (rate >= 0.2) return "bg-green-100";
  return "bg-red-100";
}

export function ResponseHeatmap({ attempts }: { attempts: CallAttempt[] }) {
  const map = buildHeatmap(attempts);

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-2" />
            {DAYS.map((d) => (
              <th key={d} className="p-2 font-medium text-gray-500 text-center">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((h) => (
            <tr key={h}>
              <td className="pr-2 py-1 text-right text-gray-500 w-12">{h}h</td>
              {DAYS.map((_, di) => {
                const cell = map.get(`${di}-${h}`);
                const rate = cell ? cell.answered / cell.total : 0;
                return (
                  <td key={di} className="p-1">
                    <div
                      title={
                        cell
                          ? `${cell.answered}/${cell.total} réponses (${Math.round(rate * 100)}%)`
                          : "Aucune donnée"
                      }
                      className={`w-10 h-10 rounded flex items-center justify-center font-medium cursor-default transition-colors ${heatColor(rate, cell?.total ?? 0)}`}
                    >
                      {cell ? `${Math.round(rate * 100)}%` : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
        <span>Taux de réponse :</span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-gray-100 inline-block" /> 0%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-green-100 inline-block" /> 1–20%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-green-300 inline-block" /> 20–40%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-green-500 inline-block" /> 40%+
        </span>
      </div>
    </div>
  );
}
