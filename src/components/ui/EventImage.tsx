import type { CSSProperties } from "react";

/** Photo d'un rendez-vous ou d'un lieu, avec cadrage et zoom optionnels (comme la maquette). */
export function EventImage({
  image,
  position,
  zoom,
  alt = "",
  priority,
}: {
  image: string | null;
  position?: string | null;
  zoom?: string | null;
  alt?: string;
  priority?: boolean;
}) {
  if (!image) return null;
  const style: Record<string, string> = { objectPosition: position || "50% 50%" };
  if (zoom) {
    for (const part of zoom.split(";")) {
      const [k, v] = part.split(":");
      if (k && v) style[k.trim()] = v.trim();
    }
  }
  return (
    <img
      src={`/img/${image}`}
      className={zoom ? "z" : undefined}
      style={style as CSSProperties}
      alt={alt}
      loading={priority ? undefined : "lazy"}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}

/** Visuel de remplacement quand un lieu n'a pas de photo : monogramme et nom. */
export function NoImage({ label, chip }: { label: string; chip?: React.ReactNode }) {
  return (
    <>
      <img className="mono" src="/img/monogramme-clair.png" alt="" />
      <span className="big">{label}</span>
      {chip}
    </>
  );
}
