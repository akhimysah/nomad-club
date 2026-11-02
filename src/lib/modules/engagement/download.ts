/**
 * Téléchargement sécurisé d'un fichier de la boutique (routes /espace/boutique/telecharger/[id]
 * et /fondatrices/boutique/fichier/[id]). Vérifie l'achat (ou l'aperçu gratuit, ou l'admin) avant de servir :
 * mode réel → redirection vers une URL signée Supabase Storage valable 60 secondes ;
 * démo → fichier envoyé par l'admin (en mémoire) ou PDF d'exemple généré au nom de l'acheteuse.
 */
import { NextResponse } from "next/server";
import { getViewer, viewerCan } from "../../auth";
import { getRepo } from "../../data";
import { fullName } from "../../format";
import { inCircle } from "../../permissions";
import { renderPdf } from "./pdf";

const NO_STORE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function serveProductFile(fileId: string): Promise<NextResponse> {
  const v = await getViewer();
  if (!v.profile) return new NextResponse("Connecte-toi pour télécharger tes ressources.", { status: 401, headers: NO_STORE });
  const repo = getRepo();
  const file = await repo.getProductFile(fileId);
  if (!file) return new NextResponse("Fichier introuvable.", { status: 404, headers: NO_STORE });
  const product = await repo.getProduct({ id: file.productId });
  if (!product) return new NextResponse("Fichier introuvable.", { status: 404, headers: NO_STORE });

  const admin = viewerCan(v, "shop.manage");
  const allowed =
    admin ||
    (product.status === "published" && file.isPreview && inCircle(v.profile)) ||
    (await repo.hasPurchased(v.profile.id, product.id));
  if (!allowed) return new NextResponse("Cette ressource n’est pas dans tes achats.", { status: 403, headers: NO_STORE });

  const delivery = await repo.fileDelivery(file);
  if (delivery.kind === "url") return NextResponse.redirect(delivery.url, { status: 302, headers: NO_STORE });
  const disposition = `attachment; filename="${file.fileName}"`;
  if (delivery.kind === "bytes")
    return new NextResponse(Buffer.from(delivery.bytes), { headers: { ...NO_STORE, "Content-Type": delivery.contentType, "Content-Disposition": disposition } });

  const pdf = renderPdf({
    title: product.title,
    subtitle: [product.subtitle, file.label].filter(Boolean).join(" · "),
    paragraphs: [
      "# Fichier d’exemple",
      "Ce PDF est généré par l’aperçu de l’appli Nomad Club. En production, c’est le vrai fichier déposé par les fondatrices qui est téléchargé, par une adresse signée valable une minute.",
      "# Présentation",
      product.description || "Description à venir.",
      ...(product.previewText ? ["# Extrait", product.previewText] : []),
      "# Pour aller plus loin",
      "Retrouve cette ressource à tout moment dans « Mes ressources », depuis ton espace membre. Une question ? Écris aux fondatrices dans le salon ou en message privé.",
    ],
    footer: `Exemplaire de ${fullName(v.profile)} · usage personnel · Marrakech Nomad Club`,
  });
  return new NextResponse(Buffer.from(pdf), { headers: { ...NO_STORE, "Content-Type": "application/pdf", "Content-Disposition": disposition } });
}
