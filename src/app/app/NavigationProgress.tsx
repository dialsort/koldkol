"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    setWidth(0);
    setVisible(true);

    timers.current.push(setTimeout(() => setWidth(85), 20));
    timers.current.push(setTimeout(() => setWidth(100), 350));
    timers.current.push(setTimeout(() => setVisible(false), 620));

    return () => timers.current.forEach(clearTimeout);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-red-500"
        style={{
          width: `${width}%`,
          transition:
            width === 0
              ? "none"
              : width === 85
                ? "width 320ms cubic-bezier(0.4,0,0.2,1)"
                : "width 180ms ease-out",
        }}
      />
    </div>
  );
}
