"use client";

import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";

export type ChartMonth = { label: string; adh: number; bil: number; current: boolean };

/** Encaissements des 12 derniers mois, dessinés à l'échelle (adhésions + billets), avec info-bulle. */
export function RevenueChart({ months, height, id }: { months: ChartMonth[]; height: number; id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const [tip, setTip] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const H = height;
  const pl = 46;
  const pr = 8;
  const pt = 26;
  const pb = 30;
  const ih = H - pt - pb;
  const iw = Math.max(0, W - pl - pr);
  const top = Math.max(...months.map((m) => m.adh + m.bil), 1);
  const max = Math.max(10000, Math.ceil(top / 2000) * 2000);
  const n = months.length;
  const band = iw / n;
  const bw = Math.min(40, band * 0.58);
  const grid: number[] = [];
  for (let g = 0; g <= max; g += max > 10000 ? 4000 : 2000) grid.push(g);

  return (
    <div className="chart-wrap" ref={ref} onPointerLeave={() => setTip(null)}>
      {W > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} height={H} role="img" aria-label="Encaissements des 12 derniers mois">
          <defs>
            <pattern id={`hatch-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#e5e5e5" />
              <rect width="3" height="6" fill="#c5c5c5" />
            </pattern>
          </defs>
          {grid.map((g) => {
            const y = pt + ih - (g / max) * ih;
            return (
              <g key={g}>
                <line x1={pl} x2={W - pr} y1={y} y2={y} stroke="#e7e7e7" strokeDasharray={g ? "3 4" : "0"} />
                <text x={pl - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#4c4c4c" fontFamily="Albert Sans,sans-serif">
                  {g ? `${g / 1000} k$` : "0"}
                </text>
              </g>
            );
          })}
          {months.map((m, i) => {
            const x = pl + band * i + (band - bw) / 2;
            const ha = (m.adh / max) * ih;
            const hb = (m.bil / max) * ih;
            const yb = pt + ih - ha;
            const tot = m.adh + m.bil;
            return (
              <g key={i}>
                <g className="bar" style={{ animationDelay: `${i * 0.04}s` }}>
                  <rect x={x} y={yb} width={bw} height={ha} fill={m.current ? "#595959" : "#333333"} rx="2" />
                  <rect x={x} y={yb - hb} width={bw} height={hb} fill={m.current ? `url(#hatch-${id})` : "#c5c5c5"} rx="5" />
                  <text x={x + bw / 2} y={yb - hb - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#323232" fontFamily="Albert Sans,sans-serif">
                    {(tot / 1000).toFixed(1).replace(".", ",")}
                  </text>
                </g>
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="12.5" fill={m.current ? "#191919" : "#4c4c4c"} fontWeight={m.current ? 700 : 500} fontFamily="Albert Sans,sans-serif">
                  {m.label}
                </text>
                <rect className="hit" x={pl + band * i} y={pt} width={band} height={ih} fill="transparent" onPointerEnter={() => setTip(i)} onPointerDown={() => setTip(i)} />
              </g>
            );
          })}
        </svg>
      )}
      {tip !== null && W > 0 && (
        <div
          className="tip on"
          style={{
            left: Math.max(110, Math.min(W - 110, pl + band * tip + band / 2)),
            top: pt + ih - ((months[tip].adh + months[tip].bil) / max) * ih - 26,
          }}
        >
          <b>{money(months[tip].adh + months[tip].bil)}</b> · {months[tip].label}
          {months[tip].current ? " (en cours)" : ""}
          <br />
          Adhésions {money(months[tip].adh)} · Billets {money(months[tip].bil)}
        </div>
      )}
    </div>
  );
}
