import Link from "next/link";
import "@/styles/partenaires.css";
import { Icon } from "../ui/Icon";

const TABS = [
  { key: "carnet", href: "/espace/carnet", icon: "book", label: "Carnet" },
  { key: "offres", href: "/espace/offres", icon: "gift", label: "Offres" },
  { key: "carte", href: "/espace/carte", icon: "pin", label: "Carte" },
] as const;

/** Navigation Carnet · Offres · Carte (sur téléphone, les trois passent par l'onglet Carnet de la barre du bas). */
export function CarnetTabs({ current }: { current: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="ptabs" aria-label="Carnet, offres et carte">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} className={current === t.key ? "on" : undefined} aria-current={current === t.key ? "page" : undefined}>
          <Icon name={t.icon} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
