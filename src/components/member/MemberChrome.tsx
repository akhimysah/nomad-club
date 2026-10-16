"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconName } from "../IconSprite";
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

function activeHref(pathname: string): string {
  if (pathname === "/espace") return "/espace";
  if (pathname.startsWith("/espace/moi")) return "/espace/moi";
  return NAV.find((n) => n.href !== "/espace" && pathname.startsWith(n.href))?.href ?? "/espace";
}

/** Barre latérale (ordinateur), en-tête et barre du bas (téléphone) de l'espace membre. */
export function MemberChrome({ name, formule, unread }: { name: string; formule: string; unread: number }) {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const title = active === "/espace/moi" ? "Moi" : (NAV.find((n) => n.href === active)?.title ?? "Accueil");
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
        </nav>
        <div className="side-foot">
          <Link href="/espace/moi" className={"me-btn" + (active === "/espace/moi" ? " on" : "")}>
            <Avatar name={name} />
            <span>
              <b>{name}</b>
              <small>{formule}</small>
            </span>
          </Link>
        </div>
      </aside>
      <MemberHeadPortal title={title} home={active === "/espace"} name={name} />
      <nav className="tabbar" aria-label="Navigation de l’appli">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={"tab" + (active === n.href ? " on" : "")} aria-current={active === n.href ? "page" : undefined}>
            <Icon name={n.icon} />
            <span className="lbl">{n.label}</span>
            {n.href === "/espace/cercle" && <CountBadge value={unread} className="badge" />}
          </Link>
        ))}
      </nav>
    </>
  );
}

function MemberHeadPortal({ title, home, name }: { title: string; home: boolean; name: string }) {
  return (
    <header className={"m-head" + (home ? " home" : "")}>
      <img className="logo" src="/img/logotype-clair.png" alt="Marrakech Nomad Club" width={279} height={120} />
      <span className="ttl">{title}</span>
      <Link className="me" href="/espace/moi" aria-label="Moi : ma carte et mon adhésion">
        <Avatar name={name} />
      </Link>
    </header>
  );
}
