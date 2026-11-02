/**
 * Notifications du Lot 4, toutes via le point d'entrée unique notify() (src/lib/notify.ts).
 * Les notifications de parrainage sont créées par la base (claim_referral, referral_on_member) ou par demo.ts.
 */
import { money } from "../../format";
import { notify } from "../../notify";
import type { Deal, Product } from "./types";

export function purchaseCompleted(profileId: string, product: Pick<Product, "title" | "slug">, amount: number) {
  return notify([
    {
      recipientId: profileId,
      type: "purchase_completed",
      title: "Ta ressource est disponible",
      body: `${product.title}${amount > 0 ? ` · ${money(amount)}` : " · offert aux membres"}. Retrouve-la dans « Mes ressources ».`,
      link: "/espace/boutique/mes-ressources",
    },
  ]);
}

export function dealDeclared(deal: Deal, declaredByName: string) {
  return notify([
    {
      recipientId: deal.partnerId,
      type: "deal_declared",
      title: "Un deal à confirmer",
      body: `${declaredByName} déclare un deal avec toi : ${deal.nature}${deal.amount ? ` (${money(deal.amount)})` : ""}. Confirme-le pour gagner tes points.`,
      link: "/espace/business",
    },
  ]);
}

export function dealAnswered(deal: Deal, partnerName: string) {
  const ok = deal.status === "confirmed";
  return notify([
    {
      recipientId: deal.declaredBy,
      type: "deal_answered",
      title: ok ? "Deal confirmé" : "Deal non confirmé",
      body: ok ? `${partnerName} a confirmé « ${deal.nature} » : +${deal.pointsEach} points pour vous deux.` : `${partnerName} n’a pas confirmé « ${deal.nature} ».`,
      link: "/espace/business",
    },
  ]);
}
