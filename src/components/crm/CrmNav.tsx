"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { IconName } from "../IconSprite";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";

const BASE = "/fondatrices/crm";

export const CRM_TABS: Array<{ href: string; label: string; icon: IconName; key: string }> = [
  { href: BASE, label: "Aperçu", icon: "grid", key: "a" },
  { href: `${BASE}/contacts`, label: "Contacts", icon: "users", key: "c" },
  { href: `${BASE}/pipeline`, label: "Pipeline", icon: "swap", key: "p" },
  { href: `${BASE}/taches`, label: "Tâches", icon: "check", key: "t" },
  { href: `${BASE}/segments`, label: "Segments", icon: "star", key: "s" },
  { href: `${BASE}/statistiques`, label: "Statistiques", icon: "wallet", key: "k" },
];

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
};

/** Onglets du CRM + raccourcis clavier (/ chercher, n nouveau contact, g puis lettre pour changer d'onglet, ? aide). */
export function CrmNav({ tasksDue }: { tasksDue: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [help, setHelp] = useState(false);
  const pending = useRef<number | null>(null);
  const active = [...CRM_TABS].reverse().find((t) => (t.href === BASE ? pathname === BASE : pathname.startsWith(t.href)))?.href ?? BASE;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (pending.current !== null) {
        const tab = CRM_TABS.find((t) => t.key === e.key.toLowerCase());
        window.clearTimeout(pending.current);
        pending.current = null;
        if (tab) {
          e.preventDefault();
          router.push(tab.href);
        }
        return;
      }
      if (e.key === "g") {
        pending.current = window.setTimeout(() => (pending.current = null), 1200);
      } else if (e.key === "/") {
        const s = document.querySelector<HTMLInputElement>("[data-crm-search]");
        if (s) {
          e.preventDefault();
          s.focus();
          s.select();
        }
      } else if (e.key === "n") {
        e.preventDefault();
        router.push(`${BASE}/contacts/nouveau`);
      } else if (e.key === "?") {
        setHelp(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="crm-top">
      <nav className="crm-tabs" aria-label="CRM">
        {CRM_TABS.map((t) => (
          <Link key={t.href} href={t.href} className={active === t.href ? "on" : undefined} aria-current={active === t.href ? "page" : undefined}>
            <Icon name={t.icon} />
            {t.label}
            {t.key === "t" && tasksDue > 0 && <span className="nbadge">{tasksDue}</span>}
          </Link>
        ))}
      </nav>
      <span className="crm-keys">
        <kbd className="k">?</kbd>
        <button type="button" onClick={() => setHelp(true)}>
          Raccourcis clavier
        </button>
      </span>
      <Sheet open={help} onClose={() => setHelp(false)} label="Raccourcis clavier">
        <h2 style={{ font: "500 26px/1.15 var(--serif)", margin: "0 0 14px" }}>Raccourcis clavier</h2>
        <dl className="kv">
          <dt>
            <kbd className="k">/</kbd>
          </dt>
          <dd>Chercher un contact</dd>
          <dt>
            <kbd className="k">n</kbd>
          </dt>
          <dd>Nouveau contact</dd>
          {CRM_TABS.map((t) => (
            <span key={t.key} style={{ display: "contents" }}>
              <dt>
                <kbd className="k">g</kbd> <kbd className="k">{t.key}</kbd>
              </dt>
              <dd>{t.label}</dd>
            </span>
          ))}
          <dt>
            <kbd className="k">j</kbd> <kbd className="k">k</kbd>
          </dt>
          <dd>Liste des contacts : ligne suivante / précédente</dd>
          <dt>
            <kbd className="k">x</kbd>
          </dt>
          <dd>Sélectionner la ligne</dd>
          <dt>
            <kbd className="k">Entrée</kbd>
          </dt>
          <dd>Ouvrir la fiche</dd>
        </dl>
      </Sheet>
    </div>
  );
}
