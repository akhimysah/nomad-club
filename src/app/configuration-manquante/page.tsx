import type { Metadata } from "next";
import { ErrorScreen } from "@/components/lancement/ErrorScreen";

export const metadata: Metadata = { title: "Configuration manquante", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Vague 2 — NEXT_PUBLIC_DEMO=false et Supabase non configuré : l'appli refuse d'afficher le sélecteur démo
 * et les données d'exemple. Rien n'est lu ici (pas d'accès aux données).
 */
export default function MissingConfigPage() {
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((k) => !process.env[k]);
  return (
    <ErrorScreen code="Configuration manquante" title="L’appli n’est pas encore branchée.">
      <p className="sh-sub">
        Le mode démo est désactivé (<code>NEXT_PUBLIC_DEMO=false</code>) et la base de données n’est pas configurée. Le site reste fermé plutôt que d’afficher des données d’exemple.
      </p>
      <ul className="lc-status">
        {missing.map((k) => (
          <li key={k}>
            <span>
              <span className="lc-dot ko" aria-hidden="true" />
              <code>{k}</code>
            </span>
            <b>à définir</b>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ marginTop: 18, fontSize: 14 }}>
        Pour l’équipe technique : renseigner ces variables dans Vercel (Settings → Environment Variables), redéployer, puis lancer <code>npm run check:env</code>. Voir
        docs/lancement/checklist.md.
      </p>
    </ErrorScreen>
  );
}
