import { NextResponse, type NextRequest } from "next/server";
import { applyUnsubscribe } from "@/lib/modules/emails/unsubscribe-apply";

export const dynamic = "force-dynamic";

/**
 * E-mails — désinscription en un clic (RFC 8058) : appelée par Gmail, Apple Mail… via l'en-tête
 * « List-Unsubscribe-Post: List-Unsubscribe=One-Click ». Le lien visible dans l'e-mail ouvre /e-mails/desinscription.
 */
export async function POST(req: NextRequest) {
  // Pas de limitation par IP : les fournisseurs de messagerie appellent depuis quelques adresses partagées ;
  // le jeton est signé (HMAC), il ne se devine pas.
  const done = await applyUnsubscribe(req.nextUrl.searchParams.get("t"));
  if (!done) return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  return NextResponse.json({ ok: true, type: done.type });
}

/** Un GET (prévisualisation de lien) ne désinscrit jamais : renvoie vers la page de confirmation. */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/e-mails/desinscription?t=${encodeURIComponent(t)}`, req.nextUrl));
}
