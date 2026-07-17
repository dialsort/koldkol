"use client";

import dynamic from "next/dynamic";

const SlotChart = dynamic(() => import("./SlotChart"), {
  ssr: false,
  loading: () => <div className="h-36 rounded-xl bg-gray-100 animate-pulse" />,
});

export default function SlotChartClient(props: React.ComponentProps<typeof SlotChart>) {
  return <SlotChart {...props} />;
}
