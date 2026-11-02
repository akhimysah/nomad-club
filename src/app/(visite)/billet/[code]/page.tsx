import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Seal } from "@/components/ui/Seal";
import { Ticket } from "@/components/ui/Ticket";
import { getRepo } from "@/lib/data";
import { isTicketCode } from "@/lib/domain/tickets";
import { isRealMode } from "@/lib/env";
import { ticketData } from "@/lib/views";

export const metadata: Metadata = { title: "Mon billet", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ paye?: string }> };

/** Page du billet (lien envoyé sur WhatsApp, retour de Stripe). */
export default async function TicketPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { paye } = await searchParams;
  const c = decodeURIComponent(code).toUpperCase();
  if (!isTicketCode(c)) notFound();
  // --- Lot 6 --- contre l'énumération des codes de billet
  const { rateLimit } = await import("@/lib/modules/securite/rate-limit");
  if (!(await rateLimit("ticketLookup")).ok) notFound();
  const b = await getRepo().getBookingByCode(c);
  if (!b || b.status === "cancelled") notFound();
  const demo = !isRealMode();
  const t = await ticketData(b);
  const pending = b.status === "pending";
  const waitlist = b.status === "waitlist";
  return (
    <div className="vscreen on">
      <div className="billet-page done">
        {paye && !pending && <Seal />}
        <div className="eyebrow">{waitlist ? "Liste d’attente" : "Mon billet"}</div>
        <h1 className="sh-title" style={{ fontSize: 36 }}>
          {b.event.title}
        </h1>
        <p className="sh-sub" style={{ maxWidth: 440 }}>
          {waitlist
            ? "Tu es sur la liste d’attente. Dès qu’une place se libère, on te prévient sur WhatsApp."
            : pending
              ? paye
                ? "Paiement en cours de confirmation. Recharge la page dans un instant."
                : "Ta place est retenue. Elle sera confirmée dès réception du paiement."
              : `Présente ce QR à l’accueil.${demo ? " Billet simulé." : ""}`}
        </p>
        {!waitlist && <Ticket t={t} pending={pending} />}
        {!waitlist && (
          <p className="fine">
            <Icon name="swap" />
            Incline ton billet pour voir le reflet doré.
          </p>
        )}
        <p style={{ marginTop: 22 }}>
          <Link className="btn btn-ghost btn-sm" href={`/rendez-vous/${b.event.slug}`}>
            Voir le rendez-vous
          </Link>
        </p>
      </div>
    </div>
  );
}
