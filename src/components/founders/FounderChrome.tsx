"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Space } from "@/lib/permissions";
import { NotifBell } from "../shell/NotifBell";
import { FOUNDER_NAV, FOUNDER_PLUS } from "./nav";
import { SpaceLinks, SpaceSheetButton } from "../shell/SpaceSwitch";
import { Icon } from "../ui/Icon";
import { TabIndicator } from "../ui/TabIndicator";
import { CountBadge } from "../ui/TweenNumber";
import { NewEventButton } from "./FounderHost";

const NAV = FOUNDER_NAV;
const PLUS = FOUNDER_PLUS;
const TABS = [...NAV.filter((n) => n.mobile), PLUS];

/** Barre latérale, en-tête (téléphone) et barre du bas de l'espace fondatrices. */
export function FounderChrome({ urgent, vir, names, notifs, spaces }: { urgent: number; vir: number; names: string; notifs: number; spaces: Space[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const active =
    pathname === "/fondatrices" ? "/fondatrices" : ([...NAV, PLUS].find((n) => n.href !== "/fondatrices" && pathname.startsWith(n.href))?.href ?? "/fondatrices");
  const title = [...NAV, PLUS].find((n) => n.href === active)?.title ?? "Vue d’ensemble";
  const tabActive = NAV.find((n) => n.href === active)?.mobile === false ? PLUS.href : active;
  const badge = (href: string, cls: string) =>
    href === "/fondatrices/a-traiter" ? (
      <CountBadge value={urgent} className={cls} />
    ) : href === "/fondatrices/encaissements" ? (
      <CountBadge value={vir} className={cls + (cls === "nbadge" ? " gold" : "")} style={cls === "badge" ? { background: "var(--accent)" } : undefined} />
    ) : href === "/fondatrices/notifications" || href === PLUS.href ? (
      <CountBadge value={notifs} className={cls} />
    ) : null;
  return (
    <>
      <aside className="f-side">
        <div className="f-brand">
          <span className="mono-tile">
            <img src="/img/monogramme-clair.png" alt="" />
          </span>
          <span>
            <b>Nomad Club</b>
            <small>Espace fondatrices</small>
          </span>
        </div>
        <label className="search">
          <Icon name="search" />
          <span className="sr">Chercher une membre</span>
          <input
            id="f-search"
            autoComplete="off"
            placeholder="Chercher une membre"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              router.replace(`/fondatrices/membres?q=${encodeURIComponent(e.target.value)}`, { scroll: false });
            }}
          />
        </label>
        <nav className="side-nav" aria-label="Espace fondatrices">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={"side-btn" + (active === n.href ? " on" : "")} aria-current={active === n.href ? "page" : undefined}>
              <Icon name={n.icon} />
              {n.label}
              {badge(n.href, "nbadge")}
            </Link>
          ))}
        </nav>
        <SpaceLinks spaces={spaces} current="founders" />
        <div className="f-who">
          <span className="stack">
            <span className="av f">J</span>
            <span className="av f">N</span>
          </span>
          <span>
            <b>{names}</b>
            <small>Fondatrices</small>
          </span>
        </div>
      </aside>
      <header className="f-head">
        <span className="mono-tile">
          <img src="/img/monogramme-clair.png" alt="" />
        </span>
        <span className="ttl">{title}</span>
        <span className="head-r">
          <SpaceSheetButton spaces={spaces} current="founders" />
          <NotifBell href="/fondatrices/notifications" count={notifs} />
          <NewEventButton className="btn btn-ink btn-sm" label="Nouvel" />
        </span>
      </header>
      <nav className="tabbar" aria-label="Navigation fondatrices">
        <TabIndicator />
        {TABS.map((n) => (
          <Link key={n.href} href={n.href} className={"tab" + (tabActive === n.href ? " on" : "")} aria-current={tabActive === n.href ? "page" : undefined}>
            <Icon name={n.icon} />
            <span className="lbl">{n.tab}</span>
            {badge(n.href, "badge")}
          </Link>
        ))}
      </nav>
    </>
  );
}
