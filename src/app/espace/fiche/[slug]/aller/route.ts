/**
 * Lot 3 — liens de contact d'une fiche (téléphone, WhatsApp, itinéraire, site…) :
 * on compte le clic pour les statistiques de l'établissement, puis on redirige.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getViewer, viewerCan } from "@/lib/auth";
import type { OrgStatKind } from "@/lib/modules/partenaires/types";
import { getRepo } from "@/lib/data";
import { visibleEstablishments } from "@/lib/modules/partenaires/server";

const KIND: Record<string, OrgStatKind> = { telephone: "contact", email: "contact", site: "contact", instagram: "contact", whatsapp: "whatsapp", itineraire: "directions" };

const digits = (s: string) => s.replace(/[^\d+]/g, "");

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const to = req.nextUrl.searchParams.get("vers") ?? "";
  const back = new URL(`/espace/fiche/${slug}`, req.url);
  const v = await getViewer();
  if (!v.profile || !viewerCan(v, "carnet.view")) return NextResponse.redirect(new URL(`/connexion?suite=${encodeURIComponent(back.pathname)}`, req.url));
  const e = (await visibleEstablishments()).find((x) => x.slug === slug);
  if (!e || !KIND[to]) return NextResponse.redirect(back);
  let target: string | null = null;
  if (to === "telephone" && e.phone) target = `tel:${digits(e.phone)}`;
  if (to === "email" && e.email) target = `mailto:${e.email}`;
  if (to === "site" && e.website && /^https:\/\//.test(e.website)) target = e.website;
  if (to === "instagram" && e.instagram) target = `https://www.instagram.com/${e.instagram.replace(/^@/, "")}`;
  if (to === "whatsapp" && e.details.whatsapp) target = `https://wa.me/${digits(e.details.whatsapp).replace(/^\+/, "")}?text=${encodeURIComponent("Bonjour, je suis membre du Nomad Club.")}`;
  if (to === "itineraire") {
    target =
      e.lat != null && e.lng != null
        ? `https://www.openstreetmap.org/directions?to=${e.lat}%2C${e.lng}`
        : `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${e.name}, ${e.address ?? ""}, Marrakech`)}`;
  }
  if (!target) return NextResponse.redirect(back);
  await getRepo().trackOrgEvent(e.id, KIND[to], v.profile.id);
  return NextResponse.redirect(target, 302);
}
