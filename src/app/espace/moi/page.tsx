import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { MembershipButton, OfferButton, TicketButton } from "@/components/member/Buttons";
import Link from "next/link";
import { InstallHelp } from "@/components/securite/InstallHelp";
import { EventImage } from "@/components/ui/EventImage";
import { Icon } from "@/components/ui/Icon";
import { MemberCard } from "@/components/ui/MemberCard";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";
import { today, ymdOf } from "@/lib/clock";
import { PRICES } from "@/lib/content";
import { getRepo } from "@/lib/data";
import { dayShort, fullName, money } from "@/lib/format";
import { membershipState, payEnv, ticketData, viewerBookings } from "@/lib/views";

export const metadata: Metadata = { title: "Ma carte et mon adhésion" };
export const dynamic = "force-dynamic";

export default async function MoiPage() {
  const v = await requireMember();
  const [m, offers, bookings] = await Promise.all([membershipState(v.profile), getRepo().listPartnerOffers(), viewerBookings(v)]);
  const env = payEnv(v);
  const demo = v.mode === "demo";
  const t = today();
  const upcoming = bookings.filter((b) => ymdOf(b.event.startsAt) >= t);
  const tickets = await Promise.all(upcoming.map((b) => ticketData(b)));
  const card = { name: fullName(v.profile), premium: m.premium, validUntil: m.endsDots, cardNumber: v.profile.cardNumber ?? "NC 0000" };
  const pct = m.renewed ? 4 : Math.max(0, Math.min(100, Math.round(((365 - m.days) / 365) * 100)));

  return (
    <Screen group="member" index={5} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow desk-only">Moi</div>
            <h1 className="scr-title">Ma carte et mon adhésion</h1>
          </div>
        </div>
        <div className="moi-grid">
          <div className="moi-card card" style={{ background: "radial-gradient(80% 60% at 50% 0%,rgba(211,211,211,.12),transparent 70%),var(--s1)" }}>
            <div style={{ width: "100%", display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <MemberCard {...card} />
            </div>
            <div className="hint">
              <Icon name="card" />
              Bouge le doigt ou la souris sur ta carte
            </div>
            <p className="muted" style={{ margin: 0, textAlign: "center", fontSize: 15 }}>
              Montre-la chez nos partenaires pour profiter de leurs offres.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <section className="card">
              <div className="row-head" style={{ marginBottom: 4 }}>
                <h2 className="h-sm">Mon adhésion</h2>
                <span className="chip gold">
                  {m.premium && <Icon name="crown" />}
                  {m.premium ? "Premium" : "Membre"}
                </span>
              </div>
              <div className="kv">
                <span>Formule</span>
                <b>{m.premium ? `Premium · ${money(PRICES.premium)} / an` : `Membre · ${money(PRICES.member)} / an`}</b>
              </div>
              <div className="kv">
                <span>Se termine le</span>
                <b>{m.endsLong || "—"}</b>
              </div>
              <div className="kv" style={{ gridTemplateColumns: "1fr" }}>
                <span>{m.renewed ? "Renouvelée, merci !" : m.pending ? "Virement en attente de validation" : m.expired ? "Adhésion échue" : `Plus que ${m.days} jours`}</span>
                <div className="prog">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: 12 }}>
                {!m.renewed && !m.pending && (
                  <MembershipButton kind="renew" plan={m.plan} amount={m.price} env={env} className="btn btn-gold btn-sm">
                    Renouveler · {money(m.price)}
                  </MembershipButton>
                )}
                {!m.premium && !m.pending && (
                  <MembershipButton kind="upgrade" plan="premium" amount={PRICES.upgrade} env={env} className="btn btn-ghost btn-sm">
                    <Icon name="crown" />
                    Passer Premium
                  </MembershipButton>
                )}
              </div>
              {!m.premium && (
                <p className="muted" style={{ fontSize: 14.5, margin: "14px 0 0" }}>
                  Premium : rendez-vous Premium offerts, une invitée par trimestre, priorité sur les dîners.
                </p>
              )}
            </section>
            <section className="card">
              <div className="row-head" style={{ marginBottom: 4 }}>
                <h2 className="h-sm">Offres partenaires</h2>
                <span className="muted" style={{ fontSize: 14 }}>
                  Sur présentation de ta carte
                </span>
              </div>
              {offers.map((o) => (
                <OfferButton key={o.id} offer={o} card={card} />
              ))}
            </section>
            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 6 }}>
                Mes réservations
              </h2>
              {upcoming.length === 0 && <div className="empty">Aucune réservation à venir.</div>}
              {upcoming.map((b, i) =>
                b.status === "waitlist" ? (
                  <div key={b.id} className="offer" style={{ cursor: "default" }}>
                    <span className="ph" style={{ width: 60, height: 60, borderRadius: 16, flex: "none" }}>
                      <EventImage image={b.event.image} position={b.event.imagePosition} />
                    </span>
                    <span>
                      <b>{b.event.title}</b>
                      <span>
                        {dayShort(b.event.startsAt)} · liste d’attente
                      </span>
                    </span>
                  </div>
                ) : (
                  <TicketButton key={b.id} ticket={tickets[i]} demo={demo} pending={b.status === "pending"} cancelId={b.id} className="offer">
                    <span className="ph" style={{ width: 60, height: 60, borderRadius: 16, flex: "none" }}>
                      <EventImage image={b.event.image} position={b.event.imagePosition} />
                    </span>
                    <span>
                      <b>{b.event.title}</b>
                      <span>
                        {dayShort(b.event.startsAt)} · {b.event.venue ?? "lieu à confirmer"}
                        {b.status === "pending" ? " · paiement en attente" : ""}
                      </span>
                    </span>
                    <Icon name="ticket" />
                  </TicketButton>
                ),
              )}
            </section>
            {/* --- Lot 6 --- */}
            <section className="card">
              <Link href="/espace/moi/donnees" className="offer">
                <span className="ph" style={{ width: 60, height: 60, borderRadius: 16, flex: "none", display: "grid", placeItems: "center" }}>
                  <Icon name="lock" />
                </span>
                <span>
                  <b>Mes données et confidentialité</b>
                  <span>Consentements, téléchargement, appareils, suppression du compte</span>
                </span>
                <Icon name="chev-r" />
              </Link>
              <div style={{ marginTop: 12 }}>
                <InstallHelp />
              </div>
            </section>
            {!demo && (
              <form action={signOut}>
                <button className="btn btn-ghost btn-block" type="submit">
                  Me déconnecter
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}
