import Link from "next/link";
import { StatusChip } from "@/components/events/EventBits";
import { AdhesionCard } from "@/components/member/AdhesionCard";
import { PlaceCard } from "@/components/member/bits";
import { AskHome, PullToRefresh, TicketButton } from "@/components/member/Buttons";
import { Countdown } from "@/components/member/Countdown";
import { Avatar } from "@/components/ui/Avatar";
import { EventImage } from "@/components/ui/EventImage";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";
import { daysBetween, nowMs, today, ymdOf } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { priceFor } from "@/lib/domain/events";
import { dayLong, dayShort, fullName, hour, messageTime, todayLong } from "@/lib/format";
import { membershipState, nextBookingOf, payEnv, ticketData, upcomingFor } from "@/lib/views";

export const dynamic = "force-dynamic";

export default async function MemberHome() {
  const v = await requireMember();
  const repo = getRepo();
  const [{ events, bookings, mine }, salon, places, m] = await Promise.all([upcomingFor(v), repo.listMessages("general"), repo.listPlaces(), membershipState(v.profile)]);
  const next = nextBookingOf(bookings);
  const soon = events.filter((e) => e.id !== next?.eventId).slice(0, 3);
  const place = places.find((p) => p.slug === "chonchon-chocolat") ?? places[0];
  const env = payEnv(v);
  const demo = v.mode === "demo";
  const now = nowMs();
  const inDays = next ? daysBetween(today(), ymdOf(next.event.startsAt)) : 0;
  const premium = v.profile.plan === "premium";

  return (
    <Screen group="member" index={0} className="mscreen scroller on">
      <PullToRefresh>
        <div className="hello">
          <div className="eyebrow">{todayLong(now, false)}</div>
          <h1 className="h-display">Bonjour {v.profile.firstName}</h1>
        </div>
        <div className="mh-grid">
          <article className="next-card">
            {next ? (
              <>
                <Link className="ph nc-ph" href={`/espace/agenda/${next.event.slug}`} data-fly aria-label="Voir le détail du rendez-vous">
                  <EventImage image={next.event.image} position={next.event.imagePosition} />
                  <span className="veil" />
                  <span className="nc-top">
                    <span className="chip solid">
                      <Icon name="check" />
                      {next.status === "pending" ? "Place retenue" : "Ta place est réservée"}
                    </span>
                  </span>
                  {next.event.imageCaption && <span className="cap">Photo : {next.event.imageCaption}</span>}
                  <span className="nc-info">
                    <span className="eyebrow">Ton prochain rendez-vous · {inDays === 0 ? "aujourd’hui" : inDays === 1 ? "demain" : `dans ${inDays} jours`}</span>
                    <span className="nc-title h-display">{next.event.title}</span>
                    <span className="nc-when">
                      {dayLong(next.event.startsAt)} · {hour(next.event.startsAt)} · {next.event.venue}
                      {next.event.address ? `, ${next.event.address}` : ""}
                    </span>
                  </span>
                </Link>
                <div className="nc-bar">
                  <div>
                    <div className="cd-label">Compte à rebours</div>
                    <Countdown target={Date.parse(next.event.startsAt)} serverNow={now} label={`Dans ${inDays} jours`} />
                  </div>
                  <div className="nc-actions">
                    <TicketButton ticket={await ticketData(next)} demo={demo} pending={next.status === "pending"} cancelId={next.id} className="btn btn-gold">
                      <Icon name="ticket" />
                      Mon billet
                    </TicketButton>
                  </div>
                </div>
              </>
            ) : (
              <div className="card lock-card">
                <Icon name="cal" />
                <h2 className="sh-title">Pas encore de rendez-vous réservé</h2>
                <p className="sh-sub">Choisis ton prochain moment au club dans l’agenda.</p>
                <Link className="btn btn-gold" href="/espace/agenda">
                  Voir l’agenda <Icon name="arrow-r" />
                </Link>
              </div>
            )}
          </article>
          <div className="mh-side">
            <AdhesionCard m={m} env={env} />
            <section className="card salon-prev">
              <div className="row-head">
                <h2 className="h-sm">Dans le salon Général</h2>
                <Link className="link" href="/espace/cercle">
                  Ouvrir <Icon name="arrow-r" />
                </Link>
              </div>
              {salon.slice(-2).map((msg) => (
                <div key={msg.id} className="msg-prev">
                  <Avatar name={msg.author ? fullName(msg.author) : "Membre"} founder={msg.author?.role === "founder"} />
                  <div>
                    <b>{msg.author ? fullName(msg.author) : "Membre"}</b>
                    <time>{messageTime(msg.createdAt, now)}</time>
                    <p>{msg.body}</p>
                  </div>
                </div>
              ))}
            </section>
            <AskHome />
          </div>
          <section className="mh-soon">
            <div className="row-head">
              <h2 className="h-sm">Bientôt au club</h2>
              <Link className="link" href="/espace/agenda">
                Tout l’agenda <Icon name="arrow-r" />
              </Link>
            </div>
            <div className="soon-grid">
              {soon.map((e) => (
                <Link key={e.id} className="soon" href={`/espace/agenda/${e.slug}`} data-fly>
                  <span className="ph">
                    <EventImage image={e.image} position={e.imagePosition} zoom={e.imageZoom} />
                  </span>
                  <span className="soon-body">
                    <span className="ev-when">
                      {dayShort(e.startsAt)} · {hour(e.startsAt)}
                    </span>
                    <b>{e.title}</b>
                    <span className="ev-place">
                      <Icon name="pin" />
                      {e.venue ?? "Lieu à confirmer"}
                    </span>
                    <span className="soon-foot">
                      <strong>{e.premiumFree ? (premium ? "Offert" : "Premium") : `${priceFor(e, v.profile.plan)} $`}</strong>
                      <StatusChip ev={e} mine={mine.get(e.id) ?? null} />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
          {place && (
            <section className="mh-addr m-addr">
              <div className="row-head">
                <h2 className="h-sm">Une adresse du carnet</h2>
                <Link className="link" href="/espace/carnet">
                  Le carnet <Icon name="arrow-r" />
                </Link>
              </div>
              <PlaceCard p={place} />
            </section>
          )}
        </div>
      </PullToRefresh>
    </Screen>
  );
}
