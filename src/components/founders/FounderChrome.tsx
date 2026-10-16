"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { IconName } from "../IconSprite";
import { Icon } from "../ui/Icon";
import { CountBadge } from "../ui/TweenNumber";
import { NewEventButton } from "./FounderHost";

const NAV: Array<{ href: string; icon: IconName; label: string; tab: string; title: string }> = [
  { href: "/fondatrices", icon: "grid", label: "Vue d’ensemble", tab: "Aperçu", title: "Vue d’ensemble" },
  { href: "/fondatrices/a-traiter", icon: "inbox", label: "À traiter", tab: "À traiter", title: "À traiter" },
  { href: "/fondatrices/membres", icon: "users", label: "Membres", tab: "Membres", title: "Membres" },
  { href: "/fondatrices/evenements", icon: "cal", label: "Événements", tab: "Événements", title: "Événements" },
  { href: "/fondatrices/encaissements", icon: "wallet", label: "Encaissements", tab: "Paiements", title: "Encaissements" },
];

/** Barre latérale, en-tête (téléphone) et barre du bas de l'espace fondatrices. */
export function FounderChrome({ urgent, vir, names }: { urgent: number; vir: number; names: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const active = pathname === "/fondatrices" ? "/fondatrices" : (NAV.find((n) => n.href !== "/fondatrices" && pathname.startsWith(n.href))?.href ?? "/fondatrices");
  const title = NAV.find((n) => n.href === active)?.title ?? "Vue d’ensemble";
  const badge = (href: string, cls: string) =>
    href === "/fondatrices/a-traiter" ? <CountBadge value={urgent} className={cls} /> : href === "/fondatrices/encaissements" ? <CountBadge value={vir} className={cls + (cls === "nbadge" ? " gold" : "")} style={cls === "badge" ? { background: "var(--accent)" } : undefined} /> : null;
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
        <NewEventButton className="btn btn-ink btn-sm" label="Nouvel" />
      </header>
      <nav className="tabbar" aria-label="Navigation fondatrices">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={"tab" + (active === n.href ? " on" : "")} aria-current={active === n.href ? "page" : undefined}>
            <Icon name={n.icon} />
            <span className="lbl">{n.tab}</span>
            {badge(n.href, "badge")}
          </Link>
        ))}
      </nav>
    </>
  );
}
