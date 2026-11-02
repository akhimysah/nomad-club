/** Petit histogramme (6 mois) en barres CSS. */
export function Bars({ data, format }: { data: Array<{ key: string; label: string; value: number }>; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars" role="img" aria-label={data.map((d) => `${d.label} : ${format ? format(d.value) : d.value}`).join(", ")}>
      {data.map((d) => (
        <div key={d.key}>
          <em>{d.value ? (format ? format(d.value) : d.value) : ""}</em>
          <i style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
