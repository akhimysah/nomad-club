import type { Metadata } from "next";
import Link from "next/link";
import { ErrorScreen } from "@/components/lancement/ErrorScreen";
import { serviceStatus } from "@/lib/modules/lancement/status";

export const metadata: Metadata = { title: "État du service", robots: { index: false } };
export const dynamic = "force-dynamic";

const Dot = ({ state }: { state: "ok" | "ko" | "off" }) => <span className={`lc-dot${state === "ok" ? "" : ` ${state}`}`} aria-hidden="true" />;

/** Vague 2 — page /statut : l'appli répond-elle, la base est-elle joignable, quels services sont branchés. */
export default async function StatusPage() {
  const s = await serviceStatus();
  const rows: Array<{ label: string; value: string; state: "ok" | "ko" | "off" }> = [
    { label: "Application", value: s.maintenance ? "En maintenance" : "En ligne", state: s.maintenance ? "ko" : "ok" },
    { label: "Mode", value: s.mode, state: s.mode === "configuration manquante" ? "ko" : s.mode === "démo" ? "off" : "ok" },
    { label: "Base de données", value: s.database.state === "ok" ? `Joignable (${s.database.ms} ms)` : s.database.state === "erreur" ? "Injoignable" : "Non utilisée (démo)", state: s.database.state === "ok" ? "ok" : s.database.state === "erreur" ? "ko" : "off" },
    { label: "Paiements", value: s.payments, state: "ok" },
    { label: "E-mails de l’appli", value: s.emails ? "Branchés" : "Non configurés", state: s.emails ? "ok" : "off" },
    { label: "Notifications push", value: s.push ? "Actives" : "Désactivées", state: s.push ? "ok" : "off" },
    { label: "Surveillance des erreurs", value: s.monitoring ? "Active" : "Désactivée", state: s.monitoring ? "ok" : "off" },
  ];
  return (
    <ErrorScreen code={s.ok ? "Tout fonctionne" : "Incident"} title="État du service" label="État du service">
      <ul className="lc-status" aria-label="Composants">
        {rows.map((r) => (
          <li key={r.label}>
            <span>
              <Dot state={r.state} />
              {r.label}
            </span>
            <b>{r.value}</b>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>
        Version {s.version} · vérifié le {new Date(s.checkedAt).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca" })} · <Link href="/api/statut">JSON</Link>
      </p>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <Link className="btn btn-ghost" href="/">
          Accueil
        </Link>
      </div>
    </ErrorScreen>
  );
}
