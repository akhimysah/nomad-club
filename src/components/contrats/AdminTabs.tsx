import Link from "next/link";
import "@/styles/contrats.css";

const TABS = [
  { href: "/fondatrices/contrats", label: "Contrats", key: "list" },
  { href: "/fondatrices/contrats/modeles", label: "Modèles", key: "templates" },
  { href: "/fondatrices/contrats/nouveau", label: "Générer un contrat", key: "new" },
] as const;

export function ContractsTabs({ on }: { on: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="ct-tabs" aria-label="Contrats">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} className={t.key === on ? "on" : undefined} aria-current={t.key === on ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
