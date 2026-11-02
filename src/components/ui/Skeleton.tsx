import type { CSSProperties, ReactNode } from "react";
import "@/styles/skeleton.css";

/*
 * Squelettes de chargement (utilisés par les loading.tsx).
 * Composants serveur, sans JavaScript : Next les affiche dès le toucher d'un onglet,
 * pendant que la vraie page se calcule. Mêmes classes d'enveloppe que les pages (mscreen, m-inner…)
 * pour que le passage au vrai contenu ne fasse pas sauter l'écran.
 */

type Size = number | string;
const px = (v: Size | undefined) => (typeof v === "number" ? `${v}px` : v);

/* ---------- primitives ---------- */

/** Bloc gris animé. */
export function SkBlock({ w, h, r, className, style }: { w?: Size; h?: Size; r?: Size; className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`sk${className ? ` ${className}` : ""}`} style={{ width: px(w), height: px(h), borderRadius: px(r), ...style }} />;
}

/** Ligne de texte (hauteur relative à la taille de police, `size` pour la fixer). */
export function SkLine({ w = "100%", size, className }: { w?: Size; size?: number; className?: string }) {
  return <SkBlock w={w} className={`sk-line${className ? ` ${className}` : ""}`} style={size ? { fontSize: size } : undefined} />;
}

/** Titre en serif (ligne plus haute). */
export function SkTitle({ w = "60%", size = 24 }: { w?: Size; size?: number }) {
  return <SkLine w={w} size={size} />;
}

/** Plusieurs lignes, la dernière plus courte. */
export function SkText({ lines = 2, size, last = "62%" }: { lines?: number; size?: number; last?: Size }) {
  return (
    <span className="sk-lines" aria-hidden="true" style={size ? { fontSize: size } : undefined}>
      {Array.from({ length: lines }, (_, i) => (
        <SkLine key={i} w={i === lines - 1 && lines > 1 ? last : "100%"} />
      ))}
    </span>
  );
}

export function SkAvatar({ size = 40, square }: { size?: number; square?: boolean }) {
  return <SkBlock w={size} h={size} r={square ? 16 : undefined} className={square ? undefined : "sk-round"} />;
}

/** Carte vide aux couleurs du club (`.card`). */
export function SkCard({ children, className, title = true }: { children?: ReactNode; className?: string; title?: boolean }) {
  return (
    <div className={`card sk-card${className ? ` ${className}` : ""}`} aria-hidden="true">
      {title && (
        <div className="sk-card-h">
          <SkTitle w="42%" size={22} />
          <SkLine w={64} size={14} />
        </div>
      )}
      {children}
    </div>
  );
}

/** Lignes de liste (avatar, deux lignes, élément à droite). */
export function SkRows({ n = 3, avatar = true, square, end = true }: { n?: number; avatar?: boolean; square?: boolean; end?: boolean }) {
  const widths = ["72%", "58%", "66%", "50%", "78%", "62%"];
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={`sk-row${avatar ? "" : " flat"}`} aria-hidden="true">
          {avatar && <SkAvatar size={40} square={square} />}
          <span className="sk-lines" style={{ fontSize: 15 }}>
            <SkLine w={widths[i % widths.length]} />
            <SkLine w="40%" size={13} />
          </span>
          {end ? <SkBlock w={56} h={28} className="sk-pill" /> : <span />}
        </div>
      ))}
    </>
  );
}

/** Carte avec image en haut (événement, offre, adresse, ressource). */
export function SkImageCard({ lines = 2, meta = true }: { lines?: number; meta?: boolean }) {
  return (
    <div className="sk-media" aria-hidden="true">
      <SkBlock />
      <div className="sk-media-body">
        {meta && <SkLine w="38%" size={12} />}
        <SkLine w="82%" className="sk-ttl" />
        <SkText lines={lines} size={15} />
      </div>
    </div>
  );
}

export function SkChips({ n = 6, widths = [70, 120, 96, 140, 104, 88, 128] }: { n?: number; widths?: number[] }) {
  return (
    <div className="sk-chips" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <SkBlock key={i} w={widths[i % widths.length]} />
      ))}
    </div>
  );
}

/* ---------- enveloppes ---------- */

const Busy = () => <span className="sr">Chargement…</span>;

/** Écran défilant de l'espace membre (même gabarit que `<Screen className="mscreen scroller on">`). */
export function SkScreen({ children, chat, space = "member" }: { children: ReactNode; chat?: boolean; space?: "member" | "org" }) {
  if (space === "org") {
    return (
      <div className="fscreen scroller on sk-screen" aria-busy="true">
        <Busy />
        <div className="f-inner">{children}</div>
      </div>
    );
  }
  if (chat) {
    return (
      <div className="mscreen chat on sk-screen" aria-busy="true">
        <Busy />
        <div className="c-wrap">{children}</div>
      </div>
    );
  }
  return (
    <div className="mscreen scroller on sk-screen" aria-busy="true">
      <Busy />
      <div className="m-inner">{children}</div>
    </div>
  );
}

export type HeadProps = {
  /** Sur-titre (texte réel, affiché tout de suite). */
  eyebrow?: string;
  /** Sur-titre masqué sur téléphone, comme sur la page. */
  deskOnly?: boolean;
  /** Titre réel ; sans titre, une barre grise. */
  title?: string;
  /** Sous-titre : nombre de lignes grises (0 = aucun). */
  sub?: number;
  /** Boutons à droite (largeurs en px). */
  actions?: number[];
};

/** En-tête d'écran (`.scr-head`) : sur-titre et titre réels quand ils sont fixes. */
export function SkHead({ eyebrow, deskOnly, title, sub = 1, actions }: HeadProps) {
  return (
    <div className="scr-head">
      <div style={{ minWidth: 0, flex: "1 1 320px" }}>
        {eyebrow ? <div className={`eyebrow${deskOnly ? " desk-only" : ""}`}>{eyebrow}</div> : <SkLine w={110} size={12.5} />}
        {title ? (
          <h1 className="scr-title">{title}</h1>
        ) : (
          <div className="scr-title" aria-hidden="true">
            <SkLine w="min(440px,70%)" />
          </div>
        )}
        {sub > 0 && (
          <div className="scr-sub" aria-hidden="true">
            {Array.from({ length: sub }, (_, i) => (
              <SkLine key={i} w={i === sub - 1 ? "min(520px,86%)" : "min(620px,100%)"} />
            ))}
          </div>
        )}
      </div>
      {actions && actions.length > 0 && (
        <div className="sk-head-actions" aria-hidden="true">
          {actions.map((w, i) => (
            <SkBlock key={i} w={w} className="sk-btn" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Onglets Carnet / Offres / Carte (textes réels, onglet actif en doré). */
export function SkTabs({ items, on }: { items: string[]; on: number }) {
  return (
    <div className="sk-tabs" aria-hidden="true">
      {items.map((t, i) => (
        <span key={t} className={i === on ? "on" : undefined}>
          {t}
        </span>
      ))}
    </div>
  );
}

/** Onglets en pastilles (boutique). */
export function SkChipTabs({ items, on }: { items: string[]; on: number }) {
  return (
    <div className="sk-chiptabs" aria-hidden="true">
      {items.map((t, i) => (
        <span key={t} className={`seg-chip${i === on ? " on" : ""}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

export const SHOP_TABS = ["Boutique", "Mes ressources"];
export const CARNET_TABS = ["Carnet", "Offres", "Carte"];

/* ---------- gabarits de pages ---------- */

/** Accueil membre à widgets. */
export function HomeSkeleton() {
  return (
    <SkScreen>
      <div
        className="dash-head"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div className="hello" style={{ marginBottom: 0 }}>
          <SkLine w={150} size={12.5} />
          <h1 className="h-display">
            Bonjour
            <SkBlock className="sk-name" />
          </h1>
        </div>
        <SkBlock w={130} h={40} className="sk-pill" />
      </div>
      <div className="sk-dash">
        <div className="sk-col">
          <div className="sk-next" aria-hidden="true">
            <SkBlock />
            <div className="sk-next-bar">
              <div className="sk-count">
                {[0, 1, 2, 3].map((i) => (
                  <SkBlock key={i} />
                ))}
              </div>
              <SkBlock w={180} h={46} className="sk-pill" />
            </div>
          </div>
          <section aria-hidden="true">
            <div className="sk-sec-h">
              <SkLine w={170} />
              <SkLine w={90} size={14} />
            </div>
            <div className="sk-soon">
              <SkImageCard lines={1} />
              <SkImageCard lines={1} />
              <SkImageCard lines={1} />
            </div>
          </section>
        </div>
        <div className="sk-col">
          <SkCard>
            <SkRows n={3} square end={false} />
          </SkCard>
          <SkCard>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <SkAvatar size={96} />
              <SkText lines={2} size={16} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <SkBlock w={110} h={40} className="sk-pill" />
              <SkBlock w={170} h={40} className="sk-pill" />
            </div>
          </SkCard>
          <SkCard>
            <SkBlock h={150} r={18} />
          </SkCard>
        </div>
      </div>
    </SkScreen>
  );
}

type GridVariant = "ev" | "offer" | "shop" | "place";

/** Page en grille de cartes : agenda, offres, boutique, carnet. */
export function GridSkeleton({
  head,
  variant,
  count = 6,
  tabs,
  chipTabs,
  search,
  chips,
}: {
  head: HeadProps;
  variant: GridVariant;
  count?: number;
  tabs?: { items: string[]; on: number };
  chipTabs?: { items: string[]; on: number };
  search?: boolean;
  chips?: number;
}) {
  return (
    <SkScreen>
      {tabs && <SkTabs {...tabs} />}
      <SkHead {...head} />
      {chipTabs && <SkChipTabs {...chipTabs} />}
      {search && <SkBlock className="sk-search" />}
      {chips ? <SkChips n={chips} /> : null}
      <div className={`sk-grid ${variant}`} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (variant === "ev" ? <SkBlock key={i} /> : <SkImageCard key={i} lines={variant === "shop" ? 1 : 2} meta={variant !== "shop"} />))}
      </div>
    </SkScreen>
  );
}

/** Page « liste » : une ou plusieurs cartes de lignes (notifications, contrats, données…). */
export function ListSkeleton({
  head,
  cards = [5],
  avatar = true,
  narrow,
  chipTabs,
}: {
  head: HeadProps;
  cards?: number[];
  avatar?: boolean;
  narrow?: boolean;
  chipTabs?: { items: string[]; on: number };
}) {
  return (
    <SkScreen>
      <SkHead {...head} />
      {chipTabs && <SkChipTabs {...chipTabs} />}
      <div className="sk-stack" style={narrow ? { maxWidth: 760 } : undefined}>
        {cards.map((n, i) => (
          <SkCard key={i}>
            <SkRows n={n} avatar={avatar} />
          </SkCard>
        ))}
      </div>
    </SkScreen>
  );
}

/** Contenu d'une colonne : nombre de lignes par carte ; 0 = carte de chiffres. */
type Col = number[];

function Column({ cards }: { cards: Col }) {
  return (
    <div className="sk-stack">
      {cards.map((n, i) =>
        n === 0 ? (
          <SkCard key={i} title={false}>
            <SkLine w={120} size={12.5} />
            <div className="sk-big">
              <SkLine w={90} />
            </div>
            <SkText lines={2} size={15} />
          </SkCard>
        ) : (
          <SkCard key={i}>
            <SkRows n={n} avatar={i % 2 === 1} end={i % 2 === 1} />
          </SkCard>
        ),
      )}
    </div>
  );
}

/** Page en deux colonnes de cartes : business, parrainage, paiements, moi. */
export function ColumnsSkeleton({
  head,
  left,
  right,
  wide,
  hero,
  note,
  member,
}: {
  head: HeadProps;
  left: Col;
  right: Col;
  /** Colonne de gauche plus large (paiements). */
  wide?: boolean;
  /** Grande carte pleine largeur avant les colonnes (parrainage). */
  hero?: boolean;
  /** Bandeau d'information avant les colonnes (business). */
  note?: boolean;
  /** Carte de membre en tête de la colonne de gauche (moi). */
  member?: boolean;
}) {
  return (
    <SkScreen>
      <SkHead {...head} />
      {note && <SkBlock className="sk-note" />}
      {hero && (
        <div className="card sk-hero" aria-hidden="true">
          <div>
            <SkLine w={150} size={12.5} />
            <SkTitle w="55%" size={40} />
            <SkBlock h={48} className="sk-pill" style={{ margin: "14px 0" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <SkBlock w={110} h={40} className="sk-pill" />
              <SkBlock w={140} h={40} className="sk-pill" />
            </div>
          </div>
          <div className="sk-stats">
            <SkBlock />
            <SkBlock />
            <SkBlock />
          </div>
        </div>
      )}
      <div className={`sk-two${wide ? " wide" : ""}`}>
        <div className="sk-stack">
          {member && (
            <div className="card sk-member" aria-hidden="true">
              <SkBlock />
              <SkLine w={240} size={14} />
              <SkText lines={2} size={15} />
            </div>
          )}
          {left.length > 0 && <Column cards={left} />}
        </div>
        <Column cards={right} />
      </div>
    </SkScreen>
  );
}

/** Fil d'actualités : cartes photo + texte. */
export function FeedSkeleton({ head, count = 3 }: { head: HeadProps; count?: number }) {
  return (
    <SkScreen>
      <SkHead {...head} />
      <div className="sk-feed" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="card sk-post">
            {i < 2 ? <SkBlock /> : null}
            <div className="sk-post-body">
              <SkLine w={180} size={13} />
              <SkLine w="74%" className="sk-ttl" />
              <SkText lines={3} />
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <SkBlock w={64} h={34} className="sk-pill" />
                <SkBlock w={64} h={34} className="sk-pill" />
                <SkBlock w={64} h={34} className="sk-pill" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SkScreen>
  );
}

/** Carte de Marrakech et liste des lieux. */
export function MapSkeleton({ head }: { head: HeadProps }) {
  return (
    <SkScreen>
      <SkTabs items={CARNET_TABS} on={2} />
      <SkHead {...head} />
      <div className="sk-mb">
        <SkChips n={4} widths={[100, 90, 120, 116]} />
      </div>
      <div className="sk-mb">
        <SkChips n={6} widths={[190, 96, 150, 92, 84, 100]} />
      </div>
      <div className="sk-map" aria-hidden="true">
        <SkBlock className="sk-map-box" />
        <div className="sk-map-side">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="sk-map-item">
              <SkAvatar size={34} />
              <span className="sk-lines">
                <SkLine w={i % 2 ? "64%" : "78%"} />
                <SkLine w="44%" size={13} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </SkScreen>
  );
}

/** Discussion : salon du cercle, fil d'un groupe, messages privés ou assistant. */
export function ChatSkeleton({ head, variant = "salon" }: { head?: HeadProps; variant?: "salon" | "thread" | "assistant" }) {
  const bubbles: Array<{ me?: boolean; w: number; h: number }> =
    variant === "assistant"
      ? [{ w: 420, h: 92 }]
      : [
          { w: 300, h: 64 },
          { w: 380, h: 86 },
          { me: true, w: 240, h: 56 },
          { w: 330, h: 64 },
          { me: true, w: 280, h: 86 },
        ];
  return (
    <SkScreen chat>
      {variant === "assistant" ? (
        <div className="sk-intro">
          <SkAvatar size={56} square />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="h-display">Une question ?</h1>
            <SkLine w="min(420px,90%)" size={15} />
          </div>
        </div>
      ) : (
        <>
          {head && <SkHead {...head} sub={0} />}
          {variant === "salon" && <SkBlock className="sk-seg" />}
          {variant === "thread" ? (
            <div className="sk-thread-head" aria-hidden="true">
              <SkAvatar size={42} />
              <SkAvatar size={44} square />
              <span className="sk-lines">
                <SkLine w="min(240px,80%)" size={20} />
                <SkLine w={140} size={13} />
              </span>
            </div>
          ) : (
            <div className="sk-chat-head" aria-hidden="true">
              <SkLine w={200} />
              <SkLine w={160} size={14} />
            </div>
          )}
        </>
      )}
      <div className="sk-log" aria-hidden="true">
        {variant !== "assistant" && <SkBlock className="sk-day" />}
        {bubbles.map((b, i) => (
          <div key={i} className={`sk-msg${b.me ? " me" : ""}`}>
            {!b.me && <SkAvatar size={34} />}
            <SkBlock w={`min(${b.w}px,100%)`} className="sk-bubble" style={{ "--h": `${b.h}px` } as CSSProperties} />
          </div>
        ))}
        {variant === "assistant" && (
          <div className="sk-sugg">
            {[250, 170, 200, 210, 160, 230].map((w, i) => (
              <SkBlock key={i} w={w} />
            ))}
          </div>
        )}
      </div>
      <div className="sk-composer" aria-hidden="true">
        <SkBlock />
      </div>
    </SkScreen>
  );
}

/** Fiche (adresse, pro du réseau) : galerie puis deux colonnes de cartes. */
export function FicheSkeleton() {
  return (
    <SkScreen>
      <SkTabs items={CARNET_TABS} on={0} />
      <SkBlock className="sk-gallery" />
      <div className="sk-split est">
        <SkCard title={false}>
          <SkLine w={120} size={12.5} />
          <SkTitle w="70%" size={36} />
          <SkText lines={4} size={16} />
        </SkCard>
        <SkCard>
          <SkRows n={4} avatar={false} end={false} />
        </SkCard>
      </div>
    </SkScreen>
  );
}

/** Produit de la boutique : couverture et description. */
export function ProductSkeleton() {
  return (
    <SkScreen>
      <SkLine w={110} size={15} />
      <div className="sk-split" style={{ marginTop: 18 }}>
        <SkBlock className="sk-cover" />
        <div aria-hidden="true">
          <SkLine w={140} size={12.5} />
          <SkTitle w="80%" size={46} />
          <SkLine w="60%" size={17} />
          <SkBlock h={96} r={22} style={{ margin: "20px 0" }} />
          <SkText lines={5} size={16} />
        </div>
      </div>
    </SkScreen>
  );
}

/** Détail d'un rendez-vous (photo à gauche, texte à droite ; photo en haut sur téléphone). */
export function EventDetailSkeleton() {
  return (
    <div className="detail open sk-screen sk-detail" aria-busy="true">
      <Busy />
      <div className="d-media" aria-hidden="true">
        <SkBlock />
      </div>
      <div className="d-scroll">
        <div className="d-body" aria-hidden="true">
          <div style={{ display: "flex", gap: 8 }}>
            <SkBlock w={90} h={28} className="sk-pill" />
            <SkBlock w={130} h={28} className="sk-pill" />
          </div>
          <div style={{ margin: "14px 0 20px" }}>
            <SkTitle w="86%" size={44} />
            <SkTitle w="50%" size={44} />
          </div>
          <div className="sk-facts">
            <SkBlock />
            <SkBlock />
            <SkBlock />
          </div>
          <div style={{ marginTop: 24 }}>
            <SkText lines={5} size={17} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tableau de bord des espaces fondatrices, partenaire et pro. */
export function OrgSkeleton({ eyebrow, title }: { eyebrow?: string; title?: string }) {
  return (
    <SkScreen space="org">
      <SkHead eyebrow={eyebrow} title={title} sub={0} />
      <div className="sk-kpis" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card">
            <SkLine w="60%" size={13} />
            <SkLine w="45%" />
            <SkLine w="80%" size={13} />
          </div>
        ))}
      </div>
      <div className="sk-fgrid">
        <div className="sk-stack" style={{ gap: 22 }}>
          <SkCard>
            <SkRows n={4} />
          </SkCard>
          <SkCard>
            <SkRows n={3} avatar={false} />
          </SkCard>
        </div>
        <div className="sk-stack" style={{ gap: 22 }}>
          <SkCard>
            <SkRows n={3} square end={false} />
          </SkCard>
          <SkCard>
            <SkBlock h={160} r={18} />
          </SkCard>
        </div>
      </div>
    </SkScreen>
  );
}
