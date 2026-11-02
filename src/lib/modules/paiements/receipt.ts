/**
 * Reçus téléchargeables : facture du prestataire si elle existe (Stripe : PDF de la facture), sinon reçu
 * PDF généré à la volée (texte simple). Vérifie que la personne a le droit de le voir.
 */
import { NextResponse } from "next/server";
import { getViewer, viewerCan } from "../../auth";
import { getRepo } from "../../data";
import { fullName, PLAN_LABEL } from "../../format";
import type { Payment } from "../../types";
import { renderPdf } from "../engagement/pdf";
import { formatMoney } from "./money";
import type { Transaction } from "./types";

const NO_STORE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const METHOD: Record<string, string> = { stripe: "Carte bancaire (Stripe)", simulated: "Carte (paiement simulé, démo)", transfer: "Virement bancaire", card: "Carte bancaire", cmi: "Carte bancaire (CMI)" };
const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca", day: "numeric", month: "long", year: "numeric" });

export function receiptPdf(input: { number: string; date: string; payer: string; label: string; amount: number; refunded: number; method: string; currency?: string }): Uint8Array {
  const issuer = process.env.PAYMENT_RECEIPT_ISSUER || "Nomad Club · Marrakech";
  return renderPdf({
    title: "Reçu de paiement",
    subtitle: `N° ${input.number} · ${dateFr(input.date)}`,
    paragraphs: [
      "# Payé par",
      input.payer,
      "# Objet",
      input.label,
      "# Montant",
      `${formatMoney(input.amount, { currency: input.currency, cents: true })} · ${input.method}`,
      ...(input.refunded > 0 ? ["# Remboursé", formatMoney(input.refunded, { currency: input.currency, cents: true })] : []),
      "# Émetteur",
      issuer,
      "Ce reçu atteste du paiement reçu. Pour une facture à votre nom (société, adresse), écrivez aux fondatrices.",
    ],
    footer: `Nomad Club · reçu ${input.number}`,
  });
}

function pdfResponse(bytes: Uint8Array, name: string): NextResponse {
  return new NextResponse(Buffer.from(bytes), { headers: { ...NO_STORE, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
}

function legacyLabel(p: Payment): string {
  if (p.kind === "booking") return "Billet de rendez-vous";
  if (p.membershipAction === "upgrade") return "Passage à Premium";
  return `${p.membershipAction === "renew" ? "Renouvellement" : "Adhésion"} ${p.plan ? PLAN_LABEL[p.plan] : ""} · 1 an`.trim();
}

/** Sert le reçu `id` (encaissement du grand livre, ou « p-<id> » pour un paiement antérieur). */
export async function serveReceipt(id: string): Promise<NextResponse> {
  const v = await getViewer();
  if (!v.profile) return new NextResponse("Connecte-toi pour télécharger tes reçus.", { status: 401, headers: NO_STORE });
  const repo = getRepo();
  const admin = viewerCan(v, "payments.validate");

  if (id.startsWith("p-")) {
    const pid = id.slice(2);
    const list = admin ? (await repo.snapshot()).payments : await repo.listPaymentsForProfile(v.profile.id);
    const p = list.find((x) => x.id === pid && x.status === "validated");
    if (!p || (!admin && p.profileId !== v.profile.id)) return new NextResponse("Reçu introuvable.", { status: 404, headers: NO_STORE });
    const number = `NC-${(p.validatedAt ?? p.declaredAt).slice(0, 4)}-P${p.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    return pdfResponse(receiptPdf({ number, date: p.validatedAt ?? p.declaredAt, payer: p.payerName, label: legacyLabel(p), amount: p.amount, refunded: 0, method: METHOD[p.method] ?? p.method }), `recu-${number}`);
  }

  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Reçu introuvable.", { status: 404, headers: NO_STORE });
  const tx: Transaction | null = await repo.payFindTransaction({ id });
  if (!tx) return new NextResponse("Reçu introuvable.", { status: 404, headers: NO_STORE });
  let allowed = admin || tx.profileId === v.profile.id;
  if (!allowed && tx.organizationId) allowed = (await repo.listMyOrganizations(v.profile.id)).some((m) => m.organization.id === tx.organizationId);
  if (!allowed) return new NextResponse("Reçu introuvable.", { status: 404, headers: NO_STORE });
  if (tx.invoicePdf && /^https:\/\//.test(tx.invoicePdf)) return NextResponse.redirect(tx.invoicePdf, { status: 302, headers: NO_STORE });

  let payer = fullName(v.profile);
  if (tx.profileId && tx.profileId !== v.profile.id) payer = (await repo.payContact(tx.profileId))?.firstName ?? "Membre";
  if (tx.organizationId) payer = (await repo.getEstablishment(tx.organizationId).catch(() => null))?.name ?? payer;
  return pdfResponse(
    receiptPdf({ number: tx.receiptNumber, date: tx.createdAt, payer, label: tx.description, amount: tx.amount, refunded: tx.amountRefunded, method: METHOD[tx.provider] ?? tx.provider, currency: tx.currency }),
    `recu-${tx.receiptNumber}`,
  );
}
