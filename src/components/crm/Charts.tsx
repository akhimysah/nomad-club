import { money, num } from "@/lib/format";
import { niceMax } from "@/lib/modules/crm/stats";

type Series = { key: string; label: string; color: string };

/**
 * Barres verticales (empilées ou côte à côte), à l'échelle, axe gradué « rond ».
 * SVG en viewBox : la largeur suit le conteneur. Chaque barre a son titre (info-bulle native).
 */
export function BarChart({
  points,
  series,
  mode = "stack",
  unit = "money",
  height = 220,
  label,
}: {
  points: Array<{ label: string } & Record<string, number | string>>;
  series: Series[];
  mode?: "stack" | "group";
  unit?: "money" | "count";
  height?: number;
  label: string;
}) {
  const W = 640;
  const H = height;
  const pl = 52;
  const pr = 6;
  const pt = 14;
  const pb = 26;
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const val = (p: (typeof points)[number], k: string) => Number(p[k] ?? 0);
  const top = Math.max(0, ...points.map((p) => (mode === "stack" ? series.reduce((a, s) => a + val(p, s.key), 0) : Math.max(...series.map((s) => val(p, s.key))))));
  const max = niceMax(top);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const band = iw / Math.max(1, points.length);
  const bw = Math.min(34, band * (mode === "stack" ? 0.6 : 0.8));
  const fmt = (v: number) => (unit === "money" ? (v >= 1000 ? `${num(v / 1000)} k$` : `${num(v)} $`) : num(v));
  const y = (v: number) => pt + ih - (v / max) * ih;
  return (
    <div className="bars">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="#e2e2e2" strokeDasharray={t ? "3 4" : undefined} />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end">
              {fmt(Math.round(t))}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const x0 = pl + band * i + (band - bw) / 2;
          let acc = 0;
          const each = bw / series.length;
          return (
            <g key={p.label + i}>
              {series.map((s, k) => {
                const v = val(p, s.key);
                const h = (v / max) * ih;
                const x = mode === "stack" ? x0 : x0 + each * k;
                const yy = mode === "stack" ? y(acc + v) : y(v);
                acc += v;
                return v > 0 ? (
                  <rect key={s.key} x={x} y={yy} width={mode === "stack" ? bw : each - 2} height={Math.max(0, h)} rx={mode === "stack" ? 3 : 2} fill={s.color}>
                    <title>{`${p.label} · ${s.label} : ${unit === "money" ? money(v) : num(v)}`}</title>
                  </rect>
                ) : null;
              })}
              <text x={pl + band * i + band / 2} y={H - 8} textAnchor="middle">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.key}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Barres horizontales (part de la plus grande valeur), avec valeur affichée. */
export function HBars({ items, unit = "money" }: { items: Array<{ label: string; value: number; sub?: string; light?: boolean }>; unit?: "money" | "count" | "pct" }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const fmt = (v: number) => (unit === "money" ? money(v) : unit === "pct" ? `${Math.round(v * 100)} %` : num(v));
  return (
    <ul className="hbars">
      {items.map((i) => (
        <li key={i.label}>
          <span>{i.label}</span>
          <span className="track" aria-hidden="true">
            <i className={i.light ? "b" : undefined} style={{ width: `${(unit === "pct" ? i.value : i.value / max) * 100}%` }} />
          </span>
          <span className="v">
            {fmt(i.value)}
            {i.sub ? <span className="muted"> · {i.sub}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
