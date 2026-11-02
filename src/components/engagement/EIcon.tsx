/** Pictogrammes propres au Lot 4 (même trait que le sprite de la maquette), sans toucher à IconSprite. */
export type EIconName = "download" | "copy" | "share" | "drag" | "up" | "down" | "sun" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm" | "moon" | "eye" | "file" | "trophy";

const PATHS: Record<EIconName, React.ReactNode> = {
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 19h14" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="3" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V4" />
      <path d="m8 8 4-4 4 4" />
      <path d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6" />
    </>
  ),
  drag: (
    <>
      <circle cx="9" cy="6" r="1.2" />
      <circle cx="15" cy="6" r="1.2" />
      <circle cx="9" cy="12" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <circle cx="9" cy="18" r="1.2" />
      <circle cx="15" cy="18" r="1.2" />
    </>
  ),
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  partly: (
    <>
      <path d="M8 4.5v1.2M3.5 9H4.7M4.8 5.8l.9.9M11.2 5.8l-.9.9" />
      <path d="M5.6 11.2A3.5 3.5 0 0 1 11.6 8" />
      <path d="M8 19h9a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 13.5 2.8 2.8 0 0 0 8 19Z" />
    </>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11.5 3.3 3.3 0 0 0 7 18Z" />,
  fog: (
    <>
      <path d="M7 13h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 6.5" />
      <path d="M4 16h16M6 19.5h12" />
    </>
  ),
  rain: (
    <>
      <path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8.5 3.3 3.3 0 0 0 7 15Z" />
      <path d="m9 18-1 2.5M13 18l-1 2.5M17 18l-1 2.5" />
    </>
  ),
  snow: (
    <>
      <path d="M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 7.5 3.3 3.3 0 0 0 7 14Z" />
      <path d="M9 18h.01M12 20h.01M15 18h.01" />
    </>
  ),
  storm: (
    <>
      <path d="M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 7.5 3.3 3.3 0 0 0 7 14Z" />
      <path d="m12.5 15-2 3.5h3l-2 3.5" />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" />
    </>
  ),
};

export function EIcon({ name, className }: { name: EIconName; className?: string }) {
  return (
    <svg className={"ic" + (className ? " " + className : "")} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
