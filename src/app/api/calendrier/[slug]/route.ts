import { NextResponse, type NextRequest } from "next/server";
import { nowIso } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { eventIcs } from "@/lib/modules/communaute/domain";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Lot 1 — Fichier .ics d'un rendez-vous publié (ajout au calendrier du téléphone ou de l'ordinateur). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = await getRepo().getEventBySlug(slug);
  if (!ev || ev.status !== "published") return NextResponse.json({ error: "Rendez-vous introuvable." }, { status: 404 });
  const url = `${await siteUrl()}/rendez-vous/${ev.slug}`;
  return new NextResponse(eventIcs(ev, url, nowIso()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ev.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
