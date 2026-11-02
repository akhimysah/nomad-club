"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Space } from "@/lib/permissions";
import type { IconName } from "../IconSprite";
import { NotifBell } from "../shell/NotifBell";
import { SpaceLinks, SpaceSheetButton } from "../shell/SpaceSwitch";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { CountBadge } from "../ui/TweenNumber";

const NAV: Array<{ href: string; icon: IconName; label: string; title: string }> = [
  { href: "/espace", icon: "home", label: "Accueil", title: "Accueil" },
  { href: "/espace/agenda", icon: "cal", label: "Agenda", title: "Agenda" },
  { href: "/espace/cercle", icon: "users", label: "Cercle", title: "Cercle" },
  { href: "/espace/carnet", icon: "book", label: "Carnet", title: "Carnet" },
  { href: "/espace/assistant", icon: "spark", label: "Assistant", title: "Assistant" },
];

// --- Lot 3 --- Offres et Carte : entrées de la barre latérale ; sur téléphone, elles passent par l'onglet Carnet
const EXTRA_NAV: Array<{ href: string; icon: IconName; label: string; title: string; prefixes: string[] }> = [
  { href: "/espace/offres", icon: "gift", label: "Offres", title: "Offres", prefixes: ["/espace/offres", "/espace/fiche"] },
  { href: "/espace/carte", icon: "pin", label: "Carte", title: "Carte", prefixes: ["/espace/carte"] },
];
const extraOf = (pathname: string) => EXTRA_NAV.find((n) => n.prefixes.some((p) => pathname.startsWith(p)));
// --- Lot 4 --- : boutique, parrainage et Espace Business (barre latérale ; sur téléphone, depuis « Moi »)
const EXTRA: Array<{ href: string; icon: IconName; label: string; title: string }> = [
  { href: "/espace/boutique", icon: "gift", label: "Boutique", title: "Boutique" },
  { href: "/espace/business", icon: "star", label: "Business", title: "Business" },
  { href: "/espace/parrainage", icon: "heart", label: "Parrainage", title: "Parrainage" },
];
// --- Lot 1 --- entrées sans onglet (barre latérale sur ordinateur ; sur téléphone : accueil et page Moi)
const LOT1_NAV: Array<{ href: string; icon: IconName; label: string; title: string }> = [
  { href: "/espace/actualites", icon: "star", label: "Actualités", title: "Actualités" },
  { href: "/espace/moderation", icon: "inbox", label: "Modération", title: "Modération" },
];

function activeHref(pathname: string): string {
  const lot4 = EXTRA.find((n) => pathname.startsWith(n.href)); // --- Lot 4 ---
  if (lot4) return lot4.href;
  if (pathname === "/espace") return "/espace";
  const lot1 = LOT1_NAV.find((n) => pathname.startsWith(n.href));
  if (lot1) return lot1.href;
  const lot3 = extraOf(pathname); // --- Lot 3 ---
  if (lot3) return lot3.href;
  if (pathname.startsWith("/espace/moi")) return "/espace/moi";
  if (pathname.startsWith("/espace/notifications")) return "/espace/notifications";
  return NAV.find((n) => n.href !== "/espace" && pathname.startsWith(n.href))?.href ?? "/espace";
}

/** Barre latérale (ordinateur), en-tête et barre du bas (téléphone) de l'espace membre. */
export function MemberChrome({
  name,
  formule,
  unread,
  notifs,
  spaces,
  moderation,
}: {
  name: string;
  formule: string;
  unread: number;
  notifs: number;
  spaces: Space[];
  /** Lot 1 : signalements ouverts (undefined si la personne ne modère pas). */
  moderation?: number;
}) {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const lot1 = LOT1_NAV.filter((n) => n.href !== "/espace/moderation" || moderation !== undefined);
  const title =
    active === "/espace/moi"
      ? "Moi"
      : active === "/espace/notifications"
        ? "Notifications"
        : ([...NAV, ...EXTRA, ...EXTRA_NAV, ...LOT1_NAV].find((n) => n.href === active)?.title ?? "Accueil");
  const tabActive = EXTRA_NAV.some((n) => n.href === active) ? "/espace/carnet" : active; // --- Lot 3 ---
  return (
    <>
      <aside className="m-side">
        <img className="logo" src="/img/logotype-clair.png" alt="Marrakech Nomad Club" width={279} height={120} />
        <nav className="side-nav" aria-label="Espace membre">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={"side-btn" + (active === n.href ? " on" : "")} aria-current={active === n.href ? "page" : undefined}>
              <Icon name={n.icon} />
              {n.label}
              {n.href === "/espace/cercle" && <CountBadge value={unread} className="nbadge" />}
            </Link>
          ))}
          {lot1.map((n) => (
            <Link key={n.href} href={n.href} className={"side-btn" + (active === n.href ? " on" : "")} aria-current={active === n.href ? "page" : undefined}>
              <Icon name={n.icon} />
              {n.label}
              {n.href === "/espace/moderation" && <CountBadge value={moderation ?? 0} className="nbadge" />}
            </Link>
          ))}
          {/* --- Lot 3 --- */}
          {EXTRA_NAV.map((n) => (
            <Link key={n.href} href={n.href} className={"side-btn" + (active === n.href ? " on" : "")} aria-current={active === n.href ? "page" : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
          <Link href="/espace/notifications" className={"side-btn" + (active === "/espace/notifications" ? " on" : "")} aria-current={active === "/espace/notifications" ? "page" : undefined}>
            <Icon name="bell" />
            Notifications
            <CountBadge value={notifs} className="nbadge" />
          </Link>
          {EXTRA.map((n) => (
            <Link key={n.href} href={n.href} className={"side-btn" + (active === n.href ? " on" : "")} aria-current={active === n.href ? "page" : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <SpaceLinks spaces={spaces} current="member" />
          <Link href="/espace/moi" className={"me-btn" + (active === "/espace/moi" ? " on" : "")}>
            <Avatar name={name} />
            <span>
              <b>{name}</b>
              <small>{formule}</small>
            </span>
          </Link>
        </div>
      </aside>
      <MemberHeadPortal title={title} home={active === "/espace"} name={name} notifs={notifs} spaces={spaces} />
      <nav className="tabbar" aria-label="Navigation de l’appli">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={"tab" + (tabActive === n.href ? " on" : "")} aria-current={tabActive === n.href ? "page" : undefined}>
            <Icon name={n.icon} />
            <span className="lbl">{n.label}</span>
            {n.href === "/espace/cercle" && <CountBadge value={unread} className="badge" />}
          </Link>
        ))}
      </nav>
    </>
  );
}

function MemberHeadPortal({ title, home, name, notifs, spaces }: { title: string; home: boolean; name: string; notifs: number; spaces: Space[] }) {
  return (
    <header className={"m-head" + (home ? " home" : "")}>
      <img className="logo" src="/img/logotype-clair.png" alt="Marrakech Nomad Club" width={279} height={120} />
      <span className="ttl">{title}</span>
      <span className="head-r">
        <SpaceSheetButton spaces={spaces} current="member" />
        <NotifBell href="/espace/notifications" count={notifs} />
        <Link className="me" href="/espace/moi" aria-label="Moi : ma carte et mon adhésion">
          <Avatar name={name} />
        </Link>
      </span>
    </header>
  );
}
