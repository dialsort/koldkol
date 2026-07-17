"use client";

import dynamic from "next/dynamic";

const shimmer = (h: number) => <div className="shimmer rounded-xl" style={{ height: h }} />;

export const SlotRateChart = dynamic(
  () => import("./StatsCharts").then((m) => m.SlotRateChart),
  { ssr: false, loading: () => shimmer(220) }
);

export const DaySlotChart = dynamic(
  () => import("./StatsCharts").then((m) => m.DaySlotChart),
  { ssr: false, loading: () => shimmer(260) }
);

export const ResultPieChart = dynamic(
  () => import("./StatsCharts").then((m) => m.ResultPieChart),
  { ssr: false, loading: () => shimmer(200) }
);
