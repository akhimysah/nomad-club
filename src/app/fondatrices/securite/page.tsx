import type { Metadata } from "next";
import Link from "next/link";
import { FHead } from "@/components/founders/parts";
import { DeletionQueue, MfaEnforceToggle, type QueueItem } from "@/components/securite/AdminSecurity";
import { MfaPanel } from "@/components/securite/MfaPanel";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { fullName } from "@/lib/format";
import { adminMfaRequired } from "@/lib/modules/securite/mfa-core";
import { pushConfigured } from "@/lib/modules/securite/push";
import { qrData } from "@/lib/qr";
import "@/styles/securite.css";

export const metadata: Metadata = { title: "Sécurité et données" };
export const dynamic = "force-dynamic";

const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Casablanca" });

/** Lot 6 — sécurité des comptes (double authentification), file des suppressions RGPD et état des protections. */
export default async function SecurityPage() {
  const v = await requireCapability("security.manage", { next: "/fondatrices/securite" });
  const repo = getRepo();
  const [requests, profiles, settings] = await Promise.all([repo.listDeletionRequests(), repo.listProfiles(), repo.getSecuritySettings()]);
  const names = new Map(profiles.map((p) => [p.id, fullName(p)]));
  const now = nowMs();
  const items: QueueItem[] = requests.map((r) => ({
    id: r.id,
    name: names.get(r.profileId) ?? "Compte",
    reason: r.reason,
    requested: dateFr(r.requestedAt),
    scheduled: dateFr(r.scheduledFor),
    due: Date.parse(r.scheduledFor) <= now,
    status: r.status,
    processed: r.processedAt ? dateFr(r.processedAt) : null,
    note: r.adminNote,
  }));
  const demo = v.mode === "demo";
  const secret = "JBSWY3DPEHPK3PXP";
  const qr = qrData(`otpauth://totp/Nomad%20Club:${encodeURIComponent(v.profile.email ?? "julia")}?secret=${secret}&issuer=Nomad%20Club`);
  const checks: Array<[boolean, string, string]> = [
    [!demo && adminMfaRequired(), "Double authentification exigée pour l’espace fondatrices", demo ? "Mode démo" : adminMfaRequired() ? "Active (ADMIN_MFA_REQUIRED)" : "Désactivée par ADMIN_MFA_REQUIRED=false"],
    [true, "En-têtes de sécurité HTTP (CSP, cadres, HSTS…)", "Actifs (next.config.ts)"],
    [true, "Limitation de fréquence (réservations, lien magique, messages, paiement)", !demo && process.env.SUPABASE_SERVICE_ROLE_KEY ? "Compteurs partagés en base" : "Compteurs en mémoire"],
    [pushConfigured(), "Notifications push", pushConfigured() ? "Clés VAPID configurées" : "Clés VAPID absentes : envoi désactivé"],
    [!demo && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), "Clé service (anonymisation complète, push, webhook)", demo ? "Mode démo" : process.env.SUPABASE_SERVICE_ROLE_KEY ? "Configurée" : "Absente"],
  ];

  return (
    <Screen group="founders" index={10} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Sécurité et données" sub="Comptes, RGPD, protections" />
        <div className="sec-grid">
          <div className="sec-col">
            <section className="card" aria-labelledby="mfa-h">
              <div className="card-h">
                <h2 id="mfa-h">Double authentification</h2>
                <span className="chip">{demo ? "Simulée" : "Supabase MFA · TOTP"}</span>
              </div>
              {demo ? (
                <>
                  <p className="muted">
                    En mode réel, après le lien magique, l’espace fondatrices demande un code à 6 chiffres (application d’authentification). Ici, une démonstration :
                    scannez le QR code d’exemple et saisissez n’importe quel code à 6 chiffres.
                  </p>
                  <MfaPanel mode="enroll" suite="/fondatrices" demo={{ qrPath: qr.d, qrSize: qr.size, secret }} />
                </>
              ) : (
                <>
                  <p className="muted">Votre session est protégée par la double authentification (niveau AAL2). Pour enrôler un nouveau téléphone, supprimez l’ancien facteur dans Supabase puis reconnectez-vous.</p>
                  <Link className="link" href="/connexion/double-authentification?suite=/fondatrices/securite">
                    Écran de double authentification <Icon name="arrow-r" />
                  </Link>
                </>
              )}
              <MfaEnforceToggle enforced={settings.adminMfaEnforced} disabled={demo ? "En démo, le réglage est enregistré mais sans effet." : null} />
            </section>

            <section className="card" aria-labelledby="checks-h">
              <div className="card-h">
                <h2 id="checks-h">Protections</h2>
              </div>
              <ul className="sec-checks">
                {checks.map(([ok, label, hint]) => (
                  <li key={label} className={ok ? "ok" : undefined}>
                    <Icon name={ok ? "check" : "x"} />
                    <span>
                      <b>{label}</b>
                      <span>{hint}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="muted sec-note">
                Sauvegardes, conservation des données, audit : voir <code>docs/securite/</code>. Toutes les opérations sensibles sont dans le{" "}
                <Link href="/fondatrices/journal?type=account">journal</Link>.
              </p>
            </section>
          </div>

          <div className="sec-col">
            <section className="card" aria-labelledby="queue-h">
              <div className="card-h">
                <h2 id="queue-h">Demandes de suppression</h2>
                <span className="muted">Délai de grâce de 30 jours</span>
              </div>
              <p className="muted">
                L’anonymisation efface le profil, les coordonnées, les consentements et le texte des messages. Les paiements et réservations restent pour la comptabilité.
              </p>
              <DeletionQueue items={items} />
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
