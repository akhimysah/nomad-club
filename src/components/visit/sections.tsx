import Link from "next/link";
import type { CSSProperties } from "react";
import { HERO, LUNCH_STEPS, PRICES, QUOTE } from "@/lib/content";
import { dayMonthLong, dayShort, money, placesText } from "@/lib/format";
import type { EventView, Memory } from "@/lib/types";
import { EventRow, FeatureCard, type Mine } from "../events/EventBits";
import type { PayEnv } from "../events/CheckoutSheet";
import { Avatar } from "../ui/Avatar";
import { EventImage } from "../ui/EventImage";
import { Icon } from "../ui/Icon";
import { JoinButton } from "./PlanButtons";
import { FreeAccountButton } from "./VisitChrome";

export function Hero({ featured, mine, members }: { featured: EventView | null; mine: Mine; members: number }) {
  const left = featured?.stats.left ?? 0;
  return (
    <header className="hero wrap" id="v-home">
      <div className="hero-media">
        <div className="ph hero-main">
          <img className="kb" src="/img/iftar-villa-yemna.jpg" alt="Une longue table dressée, des femmes réunies pour l’iftar du club" fetchPriority="high" />
          <div className="veil" />
          <span className="cap">Photo : Iftar du club à la Villa Yemna, mars 2026</span>
        </div>
        <div className="ph hero-vign">
          <img src="/img/saison-la-terraza.jpg" alt="Musiciens sur le toit de La Terraza au coucher du soleil" />
          <div className="veil" />
          <span className="cap">Photo : Lancement de saison à La Terraza, septembre 2026</span>
        </div>
        {featured && (
          <Link className="hero-float desk-only" href={`/rendez-vous/${featured.slug}`}>
            <span className="hf-dot" style={{ color: "var(--rose)" }} />
            <span className="hf-txt">
              <small>Prochain rendez-vous</small>
              <b>
                {featured.shortTitle ?? featured.title} · {dayShort(featured.startsAt)}
              </b>
              <em>{mine === "booked" ? "Ta place est réservée" : left === 1 ? "Plus qu’une place" : placesText(left)}</em>
            </span>
            <Icon name="arrow-r" />
          </Link>
        )}
      </div>
      <div className="hero-head">
        <div className="eyebrow">{HERO.eyebrow}</div>
        <h1 className="h-display">
          {HERO.titleA} <em className="gold-text">{HERO.titleB}</em>
        </h1>
      </div>
      <div className="hero-rest">
        <p>{HERO.text}</p>
        <div className="hero-cta">
          <Link className="btn btn-gold" href="/rendez-vous">
            Voir les prochains rendez-vous <Icon name="arrow-r" />
          </Link>
          <Link className="btn btn-ghost" href="/formules">
            Adhérer
          </Link>
        </div>
        <div className="hero-proof">
          <span className="stack">
            <Avatar name="Julia" />
            <Avatar name="Nora" />
            <Avatar name="Yasmine Tazi" />
            <Avatar name="Chloé Martin" />
          </span>
          <span>Fondé par Julia et Nora · {members} adhérentes</span>
        </div>
      </div>
    </header>
  );
}

export function MobileTeaser({ featured, mine }: { featured: EventView | null; mine: Mine }) {
  if (!featured) return null;
  return (
    <div className="m-only wrap m-teaser">
      <div className="row-head">
        <h2 className="h-sm">Prochain rendez-vous</h2>
        <Link className="link" href="/rendez-vous">
          Tout l’agenda <Icon name="arrow-r" />
        </Link>
      </div>
      <EventRow ev={featured} ctx="visit" mine={mine} />
    </div>
  );
}

/**
 * --- Lancement (accessibilité) --- en-tête de section : quand la section est la page entière
 * (/rendez-vous, /club, /formules), le surtitre devient le h1 (le titre reste un h2, les cartes des h3).
 */
function SecHead({ page, eyebrow, title }: { page?: boolean; eyebrow: string; title: string }) {
  return (
    <>
      {page ? (
        <h1 className="eyebrow" style={{ margin: 0 }}>
          {eyebrow}
        </h1>
      ) : (
        <div className="eyebrow">{eyebrow}</div>
      )}
      <h2 className="h-sec">{title}</h2>
    </>
  );
}

export function AgendaSection({ events, mine, hasAccount, page = false }: { events: EventView[]; mine: Map<string, Mine>; hasAccount: boolean; page?: boolean }) {
  const featured = events.find((e) => e.featured) ?? events[0];
  const rest = events.filter((e) => e !== featured);
  return (
    <section className="vsec" id="v-agenda">
      <div className="wrap">
        <div className="sec-head rv">
          <div>
            <SecHead page={page} eyebrow="Agenda" title="Prochains rendez-vous" />
          </div>
          <p>Ouverts à toutes au tarif public avec un compte gratuit. Les adhérentes paient moins. Ceux marqués Premium sont offerts aux Premium.</p>
        </div>
        {featured ? (
          <div className="agenda-grid">
            <div>
              <FeatureCard ev={featured} mine={mine.get(featured.id) ?? null} />
            </div>
            <div className="ev-list">
              <div className="ev-list-head">
                <span>Aussi au programme</span>
                <span>{events.length} rendez-vous</span>
              </div>
              {rest.map((e) => (
                <EventRow key={e.id} ev={e} ctx="visit" mine={mine.get(e.id) ?? null} />
              ))}
              {!hasAccount && (
                <div className="ev-note">
                  <Icon name="user" />
                  <span>
                    <b>Pas encore de compte ?</b>Il se crée à ta première réservation, avec ton prénom et ton WhatsApp.
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty">
            <Icon name="cal" />
            Le prochain programme arrive bientôt.
          </div>
        )}
      </div>
    </section>
  );
}

export function ClubSection({ memories, page = false }: { memories: Memory[]; page?: boolean }) {
  const words = QUOTE.text.split(" ");
  return (
    <>
      <section className="vsec" id="v-club">
        <div className="wrap">
          <div className="sec-head rv">
            <div>
              <SecHead page={page} eyebrow="Déjà vécu au club" title="Les derniers rendez-vous, avec celles qui y étaient" />
            </div>
            <p>Des tables, des terrains, des jardins. Et chaque fois, de nouvelles têtes qui deviennent des amies.</p>
          </div>
          <div className="mem-grid">
            {memories.map((m, i) => (
              <article key={m.id} className={"memory rv" + (i === 0 ? " top" : "")} style={{ transitionDelay: `${i * 0.08}s` }}>
                <div className="ph">
                  <EventImage image={m.image} position={m.imagePosition} alt={`${m.title}, ${m.place}`} />
                  <div className="veil" />
                </div>
                <span className="chip glass">{m.dateLabel}</span>
                <span className="cap">
                  Photo : {m.title}, {m.place}
                </span>
                <div className="mem-body">
                  <h3>{m.title}</h3>
                  <div className="mem-meta">{m.place}</div>
                  <div className="mem-who">
                    <span className="stack">
                      {m.attendees.map((w) => (
                        <Avatar key={w} name={w} />
                      ))}
                    </span>
                    {m.participants} participantes
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="vsec" style={{ paddingTop: 0 }}>
        <div className="wrap lunch-grid">
          <div className="collage rv">
            <div className="ph col-a">
              <img src="/img/lunch-fer7.jpg" alt="Table dressée au Fer7 avec des roses rouges" loading="lazy" />
              <div className="veil" />
              <span className="cap">Photo : Lunch au Fer7, juin 2025</span>
            </div>
            <div className="ph col-b">
              <img src="/img/brunch-prise-de-parole.jpg" alt="Une membre prend la parole pendant le brunch" loading="lazy" />
              <div className="veil" />
              <span className="cap">Photo : Brunch du club, octobre 2025</span>
            </div>
          </div>
          <div className="rv">
            <div className="eyebrow">Comment se passe un lunch</div>
            <h2 className="h-sec">Une dizaine de femmes, une belle table.</h2>
            <p className="lead">Et un fil qui aide à se parler vraiment. Celles qui arrivent seules ne le restent pas longtemps.</p>
            <ol className="steps">
              {LUNCH_STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="num gold-text">0{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <section className="quote" id="v-quote">
        <img src="/img/monogramme-clair.png" alt="" width={536} height={839} loading="lazy" />
        <blockquote>
          {words.map((w, i) => (
            <span key={i}>
              <span className="w" style={{ transitionDelay: `${(i * 0.035).toFixed(3)}s` } as CSSProperties}>
                {w}
              </span>{" "}
            </span>
          ))}
        </blockquote>
        <cite>{QUOTE.author}</cite>
      </section>
    </>
  );
}

export function FormulesSection({
  env,
  needLogin,
  nextPremium,
  applyHref = null,
  signupHref = null,
  page = false,
}: {
  env: PayEnv;
  needLogin: boolean;
  nextPremium: EventView | null;
  /** --- Lancement --- adhésion sur validation : lien de candidature à la place du paiement */
  applyHref?: string | null;
  /** --- Lancement --- mode réel : création du compte gratuit */
  signupHref?: string | null;
  page?: boolean;
}) {
  const join = (plan: "member" | "premium", label: string) =>
    applyHref ? (
      <Link className="btn btn-gold btn-block" href={applyHref}>
        Demander l’adhésion
      </Link>
    ) : (
      <JoinButton plan={plan} amount={PRICES[plan]} env={env} needLogin={needLogin}>
        {label}
      </JoinButton>
    );
  return (
    <section className="vsec" id="v-formules">
      <div className="wrap">
        <div className="sec-head rv">
          <div>
            <SecHead page={page} eyebrow="Formules" title="Compte gratuit ou adhésion" />
          </div>
          <p>Prix par an, en dollars US. Commence gratuitement, adhère quand tu veux.</p>
        </div>
        <div className="plans">
          <article className="plan rv">
            <h3>Compte gratuit</h3>
            <div className="price">
              0&nbsp;$<small>/ an</small>
            </div>
            <p className="plan-sub">Pour découvrir le club à ton rythme.</p>
            <ul>
              <li>
                <Icon name="check" />
                Les actualités, l’agenda, la discussion du club et l’assistant.
              </li>
              <li>
                <Icon name="check" />
                Réservation et paiement de ta place au tarif public.
              </li>
              <li>
                <Icon name="check" />
                Ton billet sur WhatsApp.
              </li>
            </ul>
            {env.me && !needLogin ? (
              <span className="btn btn-ghost btn-block" aria-disabled="true">
                <Icon name="check" /> Ton compte est actif
              </span>
            ) : (
              <FreeAccountButton toastText="Ton compte se crée à ta première réservation." href={signupHref} />
            )}
          </article>
          <article className="plan rv">
            <h3>Membre</h3>
            <div className="price">
              {money(PRICES.member)}
              <small>/ an</small>
            </div>
            <p className="plan-sub">Pour faire partie du cercle toute l’année.</p>
            <ul>
              <li>
                <Icon name="check" />
                Tout le compte gratuit.
              </li>
              <li>
                <Icon name="check" />
                Tarif membre aux rendez-vous ouverts : 50&nbsp;$ au lieu de 60&nbsp;$ pour un lunch.
              </li>
              <li>
                <Icon name="check" />
                Annuaire des membres et messages privés entre membres.
              </li>
              <li>
                <Icon name="check" />
                Offres des partenaires et carte de membre.
              </li>
            </ul>
            <p className="muted" style={{ fontSize: 14, margin: "-12px 0 20px" }}>
              Les rendez-vous Premium ne sont pas inclus.
            </p>
            {join("member", `Adhérer · ${money(PRICES.member)}`)}
          </article>
          <article className="plan premium rv">
            <span className="chip solid tag">
              <Icon name="crown" />
              Tout compris
            </span>
            <h3>Premium</h3>
            <div className="price">
              {money(PRICES.premium)}
              <small>/ an</small>
            </div>
            <p className="plan-sub">Pour ne rien manquer, et venir accompagnée.</p>
            <ul>
              <li>
                <Icon name="check" />
                Tout Membre.
              </li>
              <li>
                <Icon name="check" />
                Rendez-vous Premium offerts.{nextPremium ? ` Prochain : ${nextPremium.title}, le ${dayMonthLong(nextPremium.startsAt)}.` : ""}
              </li>
              <li>
                <Icon name="check" />
                Une invitée offerte par trimestre.
              </li>
              <li>
                <Icon name="check" />
                Priorité sur les dîners à places limitées.
              </li>
            </ul>
            {join("premium", `Passer Premium · ${money(PRICES.premium)}`)}
          </article>
        </div>
      </div>
    </section>
  );
}

export function VFoot({ demo }: { demo: boolean }) {
  return (
    <footer className="v-foot">
      <div className="wrap">
        <img src="/img/logotype-clair.png" alt="Marrakech Nomad Club" width={279} height={120} loading="lazy" />
        <p>
          Club de femmes et d’entrepreneuses à Marrakech, fondé par Julia et Nora.
          {demo && (
            <>
              <br />
              Aperçu privé · données d’exemple · paiements simulés.
            </>
          )}
        </p>
        {/* --- Lot 6 --- */}
        <p className="v-legal">
          <Link href="/cgu">Conditions d’utilisation</Link> · <Link href="/confidentialite">Confidentialité</Link> · <Link href="/mentions-legales">Mentions légales</Link> · <Link href="/mes-donnees">Mes données</Link>
        </p>
      </div>
    </footer>
  );
}
