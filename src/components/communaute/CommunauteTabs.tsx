import Link from "next/link";

const TABS = [
  { href: "/fondatrices/communaute/actualites", label: "Actualités" },
  { href: "/fondatrices/communaute/groupes", label: "Groupes" },
  { href: "/fondatrices/communaute/moderation", label: "Modération" },
] as const;

/** Lot 1 — Onglets de la section Communauté (espace fondatrices). */
export function CommunauteTabs({ active, counts }: { active: (typeof TABS)[number]["href"]; counts?: Partial<Record<(typeof TABS)[number]["href"], number>> }) {
  return (
    <nav className="seg-chips" aria-label="Communauté">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={"seg-chip" + (active === t.href ? " on" : "")} aria-current={active === t.href ? "page" : undefined}>
          {t.label}
          {counts?.[t.href] ? <b>{counts[t.href]}</b> : null}
        </Link>
      ))}
    </nav>
  );
}
