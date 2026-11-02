/** Widgets de l'accueil membre (composants serveur). Les blocs historiques de l'accueil sont repris tels quels. */
import Link from "next/link";
import { StatusChip, type Mine } from "@/components/events/EventBits";
import { PlaceCard } from "@/components/member/bits";
import { OfferButton, TicketButton } from "@/components/member/Buttons";
import { Countdown } from "@/components/member/Countdown";
import { Avatar } from "@/components/ui/Avatar";
import { EventImage } from "@/components/ui/EventImage";
import { Icon } from "@/components/ui/Icon";
import { hmOf, nowMs, today, ymdOf, daysBetween } from "@/lib/clock";
import { priceFor } from "@/lib/domain/events";
import { dayLong, dayMonthShort, dayNumber, dayShort, fullName, hour, messageTime, monthShortOf, plural } from "@/lib/format";
import type { DashboardNews } from "@/lib/modules/engagement/news-source";
import { getPrayerTimes, nextPrayer } from "@/lib/modules/engagement/prayer";
import type { Quote } from "@/lib/modules/engagement/quotes";
import { getWeather, weatherLabel } from "@/lib/modules/engagement/weather";
import { isAdmin } from "@/lib/permissions";
import type { TicketData } from "@/components/ui/Ticket";
import type { BookingView, EventView, MessageView, PartnerOffer, Place, Plan } from "@/lib/types";
import { EIcon } from "./EIcon";

function Head({ title, href, cta, icon }: { title: string; href?: string; cta?: string; icon?: React.ReactNode }) {
  return (
    <div className="row-head">
      <h2 className="h-sm w-title">
        {icon}
        {title}
      </h2>
      {href && (
        <Link className="link" href={href}>
          {cta ?? "Voir"} <Icon name="arrow-r" />
        </Link>
      )}
    </div>
  );
}

/* ---------- obligatoires ---------- */

export function NextWidget({ next, ticket, demo }: { next: BookingView | null; ticket: TicketData | null; demo: boolean }) {
  const now = nowMs();
  if (!next || !ticket)
    return (
      <div className="card lock-card">
        <Icon name="cal" />
        <h2 className="sh-title">Pas encore de rendez-vous réservé</h2>
        <p className="sh-sub">Choisis ton prochain moment au club dans l’agenda.</p>
        <Link className="btn btn-gold" href="/espace/agenda">
          Voir l’agenda <Icon name="arrow-r" />
        </Link>
      </div>
    );
  const inDays = daysBetween(today(), ymdOf(next.event.startsAt));
  return (
    <article className="next-card">
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
          <TicketButton ticket={ticket} demo={demo} pending={next.status === "pending"} cancelId={next.id} className="btn btn-gold">
            <Icon name="ticket" />
            Mon billet
          </TicketButton>
        </div>
      </div>
    </article>
  );
}

export function EventsWidget({ soon, mine, plan }: { soon: EventView[]; mine: Map<string, Mine>; plan: Plan }) {
  const premium = plan === "premium";
  return (
    <section className="mh-soon">
      <Head title="Bientôt au club" href="/espace/agenda" cta="Tout l’agenda" />
      {soon.length === 0 && <p className="w-empty">Le prochain programme arrive bientôt.</p>}
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
                <strong>{e.premiumFree ? (premium ? "Offert" : "Premium") : `${priceFor(e, plan)} $`}</strong>
                <StatusChip ev={e} mine={mine.get(e.id) ?? null} />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function NewsWidget({ news }: { news: DashboardNews[] }) {
  return (
    <section className="card">
      <Head title="Actualités du club" icon={<Icon name="bell" />} />
      {news.length === 0 && <p className="w-empty">Les actualités du club apparaîtront ici.</p>}
      {news.map((n) => {
        const body = (
          <>
            {n.image && (
              <span className="ph">
                <EventImage image={n.image.replace(/^\/img\//, "")} position={null} />
              </span>
            )}
            <span>
              <b>
                {n.pinned && <span className="sr">Épinglé : </span>}
                {n.title}
              </b>
              <p>{n.excerpt}</p>
              <time>
                {n.pinned ? "Épinglé · " : ""}
                {dayMonthShort(n.publishedAt)} · {n.author}
              </time>
            </span>
          </>
        );
        return n.link ? (
          <Link key={n.id} className="nw-item" href={n.link}>
            {body}
          </Link>
        ) : (
          <div key={n.id} className="nw-item">
            {body}
          </div>
        );
      })}
      {news.some((n) => n.sample) && <div className="w-foot">Exemples · le fil d’actualités arrive avec l’espace Communauté.</div>}
    </section>
  );
}

/* ---------- facultatifs ---------- */

export function SalonWidget({ salon }: { salon: MessageView[] }) {
  const now = nowMs();
  return (
    <section className="card salon-prev">
      <Head title="Dans le salon Général" href="/espace/cercle" cta="Ouvrir" />
      {salon.slice(-2).map((msg) => (
        <div key={msg.id} className="msg-prev">
          <Avatar name={msg.author ? fullName(msg.author) : "Membre"} founder={isAdmin(msg.author)} />
          <div>
            <b>{msg.author ? fullName(msg.author) : "Membre"}</b>
            <time>{messageTime(msg.createdAt, now)}</time>
            <p>{msg.body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

export function AddressWidget({ place }: { place: Place | null }) {
  if (!place) return null;
  return (
    <section className="mh-addr m-addr">
      <Head title="Une adresse du carnet" href="/espace/carnet" cta="Le carnet" />
      <PlaceCard p={place} />
    </section>
  );
}

export function AgendaWidget({ bookings }: { bookings: BookingView[] }) {
  const t = today();
  const list = bookings.filter((b) => ymdOf(b.event.startsAt) >= t).slice(0, 4);
  return (
    <section className="card">
      <Head title="Mon agenda" href="/espace/moi" cta="Mes billets" icon={<Icon name="cal" />} />
      {list.length === 0 && <p className="w-empty">Aucune réservation à venir.</p>}
      {list.map((b) => (
        <Link key={b.id} className="ag-item" href={`/espace/agenda/${b.event.slug}`}>
          <span className="ag-date">
            <b>{dayNumber(b.event.startsAt)}</b>
            <span>{monthShortOf(b.event.startsAt)}</span>
          </span>
          <span style={{ minWidth: 0 }}>
            <strong>{b.event.shortTitle ?? b.event.title}</strong>
            <small>
              {hour(b.event.startsAt)} · {b.event.venue ?? "lieu à confirmer"}
            </small>
          </span>
          <span className="st">{b.status === "waitlist" ? "Liste d’attente" : b.status === "pending" ? "À payer" : "Réservé"}</span>
        </Link>
      ))}
    </section>
  );
}

export function OffersWidget({ offers, card }: { offers: PartnerOffer[]; card: { name: string; premium: boolean; validUntil: string; cardNumber: string } }) {
  return (
    <section className="card">
      <Head title="Offres du moment" href="/espace/moi" cta="Toutes" icon={<Icon name="gift" />} />
      {offers.length === 0 && <p className="w-empty">Pas d’offre en ce moment.</p>}
      {offers.slice(0, 3).map((o) => (
        <OfferButton key={o.id} offer={o} card={card} />
      ))}
    </section>
  );
}

export function PointsWidget({ total, toConfirm, deals }: { total: number; toConfirm: number; deals: number }) {
  return (
    <section className="card">
      <Head title="Mes points Business" href="/espace/business" cta="Espace Business" icon={<Icon name="star" />} />
      <div className="big-num">
        {total}
        <small>{plural(total, "point", "points")}</small>
      </div>
      <p className="w-empty">
        {deals} {plural(deals, "deal confirmé", "deals confirmés")}
        {toConfirm > 0 ? ` · ${toConfirm} à confirmer` : ""}
      </p>
      {toConfirm > 0 && (
        <Link className="btn btn-gold btn-sm" href="/espace/business" style={{ marginTop: 12 }}>
          Confirmer {plural(toConfirm, "mon deal", "mes deals")}
        </Link>
      )}
    </section>
  );
}

export function ReferralWidget({ code, signedUp, members }: { code: string; signedUp: number; members: number }) {
  return (
    <section className="card">
      <Head title="Parrainage" href="/espace/parrainage" cta="Inviter" icon={<Icon name="users" />} />
      <div className="eyebrow">Mon code</div>
      <div className="ref-code" style={{ fontSize: 30, margin: "6px 0 8px" }}>
        {code}
      </div>
      <p className="w-empty">
        {signedUp + members} {plural(signedUp + members, "filleule", "filleules")} · {members} {plural(members, "devenue membre", "devenues membres")}
      </p>
    </section>
  );
}

export function QuoteWidget({ quote }: { quote: Quote }) {
  return (
    <figure className="card quote-w" style={{ margin: 0 }}>
      <div className="eyebrow">Citation du jour</div>
      <blockquote>« {quote.text} »</blockquote>
      <figcaption>{quote.author}</figcaption>
    </figure>
  );
}

export function WidgetSkeleton({ title }: { title: string }) {
  return (
    <section className="card" aria-busy="true">
      <Head title={title} />
      <div className="w-skel" />
    </section>
  );
}

const fmtDay = (ymd: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(new Date(ymd + "T12:00:00Z")).replace(".", "");

/** Météo à Marrakech (Open-Meteo, cache 30 min). */
export async function WeatherWidget() {
  const w = await getWeather();
  if (!w.ok)
    return (
      <section className="card">
        <Head title="Météo à Marrakech" icon={<EIcon name="sun" />} />
        <p className="w-empty">La météo est indisponible pour le moment. Réessaie un peu plus tard.</p>
      </section>
    );
  const d = w.data;
  const now = weatherLabel(d.code);
  return (
    <section className="card">
      <Head title="Météo à Marrakech" icon={<EIcon name="sun" />} />
      <div className="wx-now">
        <EIcon name={!d.isDay && (now.kind === "sun" || now.kind === "partly") ? "moon" : now.kind} />
        <div className="wx-temp">
          {Math.round(d.temperature)}
          <small>°C</small>
        </div>
        <div className="wx-desc">
          <b>{now.label}</b>
          <span>
            Ressenti {Math.round(d.feelsLike)}° · vent {Math.round(d.wind)} km/h
          </span>
        </div>
      </div>
      <div className="wx-days">
        {d.days.slice(1, 4).map((x) => (
          <div key={x.date} className="wx-day">
            <span>{fmtDay(x.date)}</span>
            <EIcon name={weatherLabel(x.code).kind} />
            <b>{Math.round(x.max)}°</b> <span>{Math.round(x.min)}°</span>
          </div>
        ))}
      </div>
      <div className="w-foot">
        <span>
          {d.sunrise && d.sunset ? `Soleil ${d.sunrise} – ${d.sunset}` : ""}
          {w.stale ? " · dernière mesure connue" : ""}
        </span>
        <span>Open-Meteo</span>
      </div>
    </section>
  );
}

/** Heures de prière à Marrakech (Aladhan, méthode du Maroc ; calcul local en repli). */
export async function PrayerWidget() {
  const ymd = today();
  const p = await getPrayerTimes(ymd);
  const next = nextPrayer(p, hmOf(new Date(nowMs()).toISOString()));
  return (
    <section className="card">
      <Head title="Heures de prière" icon={<Icon name="clock" />} />
      <ul className="pr-list">
        {p.times.map((t) => (
          <li key={t.name} className={(t.name === next ? "next" : "") + (t.name === "Chourouk" ? " sun" : "")}>
            <span>{t.label}</span>
            <b>{t.time}</b>
          </li>
        ))}
      </ul>
      <div className="w-foot">
        <span>
          Marrakech{p.hijri ? ` · ${p.hijri}` : ""}
        </span>
        <span>{p.source === "aladhan" ? "Aladhan · méthode Maroc" : "Calcul approché"}</span>
      </div>
    </section>
  );
}
