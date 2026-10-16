"use client";

import { useId, type CSSProperties } from "react";

/** Sceau argenté qui tourne, avec la coche qui se dessine et les étincelles (confirmation). */
export function Seal() {
  const id = "sg" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const pts: string[] = [];
  const R = 58;
  const r = 52;
  const k = 28;
  for (let i = 0; i < k * 2; i++) {
    const a = (Math.PI * i) / k;
    const rr = i % 2 ? r : R;
    pts.push((60 + rr * Math.cos(a)).toFixed(2) + "," + (60 + rr * Math.sin(a)).toFixed(2));
  }
  return (
    <div className="seal" aria-hidden="true">
      {Array.from({ length: 12 }, (_, j) => (
        <i key={j} className="spark" style={{ "--a": `${j * 30}deg`, animationDelay: `${0.3 + j * 0.015}s` } as CSSProperties} />
      ))}
      <svg viewBox="0 0 120 120">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#efefef" />
            <stop offset=".45" stopColor="#d3d3d3" />
            <stop offset=".75" stopColor="#b2b2b2" />
            <stop offset="1" stopColor="#e4e4e4" />
          </linearGradient>
        </defs>
        <g className="ring">
          <polygon points={pts.join(" ")} fill={`url(#${id})`} />
        </g>
        <circle cx="60" cy="60" r="43" fill="none" stroke="rgba(22,22,22,.35)" strokeWidth="1.2" strokeDasharray="2 3" />
        <circle cx="60" cy="60" r="38" fill="rgba(246,246,246,.25)" />
        <path className="ck" d="M43 61l12 12 23-25" fill="none" stroke="#151515" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
