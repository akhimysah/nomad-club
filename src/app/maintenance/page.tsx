import type { Metadata } from "next";
import Link from "next/link";
import { ErrorScreen } from "@/components/lancement/ErrorScreen";

export const metadata: Metadata = { title: "Maintenance", robots: { index: false } };

/** Vague 2 — affichée partout quand MAINTENANCE_MODE=true (réponse 503, voir src/lib/modules/lancement/gate.ts). */
export default function MaintenancePage() {
  return (
    <ErrorScreen code="Maintenance" title="On peaufine l’appli.">
      <p className="sh-sub">Le Nomad Club revient dans quelques minutes. Tes réservations et tes données sont en sécurité.</p>
      <div className="btn-row">
        <Link className="btn btn-ghost" href="/statut">
          État du service
        </Link>
      </div>
    </ErrorScreen>
  );
}
