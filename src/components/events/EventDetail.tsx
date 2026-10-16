import Link from "next/link";
import { today, ymdOf } from "@/lib/clock";
import { priceFor } from "@/lib/domain/events";
import { membershipAmount } from "@/lib/domain/membership";
import { dayLong, placesText, timeRange } from "@/lib/format";
import type { EventView, Viewer } from "@/lib/types";
import { checkoutEvent, payEnv, ticketData, viewerBookings } from "@/lib/views";
import { Icon } from "../ui/Icon";
import { DetailShell, type DetailCta } from "./DetailShell";
import { StatusChip, type Mine } from "./EventBits";

/** Détail complet d'un rendez-vous et son bouton d'action, selon la formule de la personne. */
export async function EventDetail({ ev, ctx, viewer, backHref }: { ev: EventView; ctx: "visit" | "member"; viewer: Viewer; backHref: string }) {
  const bookings = await viewerBookings(viewer);
  const mineB = bookings.find((b) => b.eventId === ev.id && b.status !== "cancelled") ?? null;
  const mine: Mine = mineB ? (mineB.status === "waitlist" ? "waitlist" : "booked") : null;
  const plan = viewer.profile?.plan ?? "free";
  const isMember = plan !== "free";
  const premium = plan === "premium";
  const left = ev.stats.left;
  const past = ymdOf(ev.startsAt) < today();
  const price = priceFor(ev, plan);

  let cta: DetailCta;
  if (mine === "booked" && mineB) {
    cta = {
      act: "ticket",
      p: mineB.status === "pending" ? "Retenue" : "Réservé",
      s: mineB.status === "pending" ? "Paiement en attente" : isMember ? (mineB.amount ? `Tarif adhérente · ${mineB.amount} $` : "Offert") : "Billet sur WhatsApp",
      label: "Mon billet",
      ticket: await ticketData(mineB),
      pending: mineB.status === "pending",
      cancelId: viewer.profile && !past ? mineB.id : null,
    };
  } else if (mine === "waitlist") cta = { act: "none", p: "Liste d’attente", s: "On te prévient dès qu’une place se libère", label: "Tu es inscrite" };
  else if (past) cta = { act: "none", p: "Terminé", s: "Ce rendez-vous est passé", label: "Passé" };
  else if (ev.premiumFree && !premium)
    cta = isMember
      ? { act: "upgrade", p: "Premium", s: "Offert aux Premium", label: "Passer Premium", amount: membershipAmount("upgrade", "premium") }
      : { act: "plans", p: "Premium", s: "Offert avec la formule Premium", label: "Découvrir Premium" };
  else if (left <= 0) cta = { act: "wait", p: ev.premiumFree ? "Offert" : `${price} $`, s: `Complet · ${ev.stats.waitlist} en attente`, label: "Liste d’attente" };
  else
    cta = {
      act: "book",
      p: price ? `${price} $` : "Offert",
      s: isMember && !ev.premiumFree ? `Tarif adhérente · ${placesText(left)}` : placesText(left),
      label: "Réserver ma place",
      amount: price ?? 0,
    };

  const pct = Math.round((ev.stats.taken / Math.max(1, ev.capacity)) * 100);
  const env = payEnv(viewer);
  return (
    <DetailShell image={ev.image} imagePosition={ev.imagePosition} caption={ev.imageCaption} backHref={backHref} cta={cta} ctx={ctx} event={checkoutEvent(ev)} env={env}>
      <div className="d-chips">
        {ev.featured && (
          <span className="chip solid">
            <Icon name="star" />À la une
          </span>
        )}
        <StatusChip ev={ev} mine={mine} />
      </div>
      <h1 className="d-title h-display" id="d-title">
        {ev.title}
      </h1>
      <div className="facts">
        <div className="fact">
          <span className="fi">
            <Icon name="cal" />
          </span>
          <div>
            <b>{dayLong(ev.startsAt)}</b>
            <span>{timeRange(ev.startsAt, ev.endsAt)}</span>
          </div>
        </div>
        <div className="fact">
          <span className="fi">
            <Icon name="pin" />
          </span>
          <div>
            <b>{ev.venue ?? "Lieu à confirmer"}</b>
            <span>{ev.address}</span>
          </div>
        </div>
        <div className="fact">
          <span className="fi">
            <Icon name="users" />
          </span>
          <div style={{ flex: 1 }}>
            <b>{placesText(left)}</b>
            <span>
              {ev.stats.taken} inscrites sur {ev.capacity}
              {ev.stats.waitlist && left <= 0 ? ` · ${ev.stats.waitlist} en liste d’attente` : ""}
            </span>
            <div className="fill">
              <i className="paid" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>
      <p className="d-lead">{ev.description}</p>
      {ev.program.length > 0 && (
        <>
          <h2 className="d-h">Le déroulé</h2>
          <ol className="timeline">
            {ev.program.map((s) => (
              <li key={s.time + s.title}>
                <span className="t">{s.time}</span>
                <b>{s.title}</b>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </>
      )}
      {ev.premiumFree ? (
        <div className="prices">
          <div className={"price-t" + (premium ? " me" : "")}>
            <span>Premium</span>
            <b>Offert</b>
            <small>Inclus dans la formule</small>
          </div>
          <div className={"price-t" + (!premium ? " me" : "")}>
            <span>Compte gratuit et Membre</span>
            <b style={{ fontSize: 24, paddingTop: 6 }}>Non inclus</b>
            <small>Réservé aux Premium</small>
          </div>
        </div>
      ) : (
        <div className="prices">
          <div className={"price-t" + (!isMember ? " me" : "")}>
            <span>Tarif public</span>
            <b>{ev.pricePublic}&nbsp;$</b>
            <small>Avec un compte gratuit</small>
          </div>
          <div className={"price-t" + (isMember ? " me" : "")}>
            <span>Tarif adhérente</span>
            <b>{ev.priceMember}&nbsp;$</b>
            <small>Membre et Premium</small>
          </div>
        </div>
      )}
      <p className="fine">
        <Icon name="lock" />
        {env.mode === "demo" ? "Paiement en ligne simulé. Billet envoyé sur WhatsApp." : env.mode === "stripe" ? "Paiement en ligne sécurisé. Billet envoyé sur WhatsApp." : "Paiement par virement, validé par Julia et Nora."}
      </p>
      {ctx === "visit" && !isMember && !ev.premiumFree && (
        <p style={{ textAlign: "center", margin: "4px 0 0" }}>
          <Link className="link" href="/formules">
            Voir l’adhésion · tarif membre {ev.priceMember}&nbsp;$ <Icon name="arrow-r" />
          </Link>
        </p>
      )}
    </DetailShell>
  );
}
