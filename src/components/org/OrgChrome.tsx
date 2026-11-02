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

/** `tab: false` : entrée de la barre latérale seulement (pas d'onglet sur téléphone). */
export type OrgNavItem = { href: string; icon: IconName; label: string; soon?: boolean; tab?: boolean };

/**
 * Barre latérale (ordinateur), en-tête et barre du bas (téléphone) des espaces Partenaire et Pro.
 * Même langage que l'espace fondatrices (version jour). Les entrées « soon » annoncent les lots suivants.
 */
export function OrgChrome({
  space,
  title,
  nav,
  name,
  orgName,
  notifs,
  spaces,
}: {
  space: Extract<Space, "partner" | "pro">;
  title: string;
  nav: OrgNavItem[];
  name: string;
  orgName: string;
  notifs: number;
  spaces: Space[];
}) {
  const pathname = usePathname();
  const home = nav[0].href;
  const real = nav.filter((n) => !n.soon);
  const active = pathname === home ? home : (real.find((n) => n.href !== home && pathname.startsWith(n.href))?.href ?? home);
  const notifHref = `${home}/notifications`;
  const headTitle = real.find((n) => n.href === active)?.label ?? title;
  return (
    <>
      <aside className="f-side">
        <div className="f-brand">
          <span className="mono-tile">
            <img src="/img/monogramme-clair.png" alt="" />
          </span>
          <span>
            <b>Nomad Club</b>
            <small>{title}</small>
          </span>
        </div>
        <nav className="side-nav" aria-label={title}>
          {nav.map((n) =>
            n.soon ? (
              <span key={n.href} className="side-btn is-soon" aria-disabled="true">
                <Icon name={n.icon} />
                {n.label}
                <span className="chip">Bientôt</span>
              </span>
            ) : (
              <Link key={n.href} href={n.href} className={"side-btn" + (active === n.href ? " on" : "")} aria-current={active === n.href ? "page" : undefined}>
                <Icon name={n.icon} />
                {n.label}
                {n.href === notifHref && <CountBadge value={notifs} className="nbadge" />}
              </Link>
            ),
          )}
        </nav>
        <SpaceLinks spaces={spaces} current={space} />
        <div className="f-who">
          <Avatar name={name} />
          <span>
            <b>{name}</b>
            <small>{orgName}</small>
          </span>
        </div>
      </aside>
      <header className="f-head">
        <span className="mono-tile">
          <img src="/img/monogramme-clair.png" alt="" />
        </span>
        <span className="ttl">{headTitle}</span>
        <span className="head-r">
          <SpaceSheetButton spaces={spaces} current={space} />
          <NotifBell href={notifHref} count={notifs} />
        </span>
      </header>
      <nav className="tabbar" aria-label={title}>
        {real.filter((n) => n.tab !== false).map((n) => (
          <Link key={n.href} href={n.href} className={"tab" + (active === n.href ? " on" : "")} aria-current={active === n.href ? "page" : undefined}>
            <Icon name={n.icon} />
            <span className="lbl">{n.label}</span>
            {n.href === notifHref && <CountBadge value={notifs} className="badge" />}
          </Link>
        ))}
      </nav>
    </>
  );
}
