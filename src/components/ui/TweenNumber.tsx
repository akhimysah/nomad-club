"use client";

import { useEffect, useRef, useState } from "react";
import { money, num } from "@/lib/format";

/** Nombre qui défile jusqu'à sa nouvelle valeur quand les données changent (compteurs des fondatrices). */
export function TweenNumber({ value, format = "num" }: { value: number; format?: "num" | "money" }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      setShown(start + (value - start) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format === "money" ? money(shown) : num(shown)}</>;
}

/** Pastille de compteur qui rebondit quand elle change. */
export function CountBadge({ value, className, style }: { value: number; className: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    const el = ref.current;
    if (!el) return;
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }, [value]);
  if (!value) return null;
  return (
    <span ref={ref} className={className} style={style}>
      {value}
    </span>
  );
}
