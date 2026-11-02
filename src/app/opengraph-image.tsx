import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Vague 2 — image de partage (Open Graph / réseaux) générée avec le logo du club. */
export const alt = "Nomad Club · club de femmes et d’entrepreneuses à Marrakech";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/img/logotype-clair.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(80% 70% at 50% 0%, #2a2a2a 0%, #0b0b0b 70%)",
          color: "#f3f3f3",
          fontFamily: "serif",
        }}
      >
        <img src={src} alt="" width={558} height={240} />
        <div style={{ marginTop: 36, fontSize: 40, letterSpacing: 1, color: "#d5d5d5" }}>Club de femmes et d’entrepreneuses à Marrakech</div>
        <div style={{ marginTop: 18, fontSize: 26, color: "#9a9a9a", fontFamily: "sans-serif" }}>Rendez-vous · carnet d’adresses · cercle de membres</div>
      </div>
    ),
    size,
  );
}
