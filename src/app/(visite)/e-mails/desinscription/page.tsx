import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribeAction } from "@/app/actions/emails";
import { Screen } from "@/components/ui/Screen";
import { readUnsubscribeToken } from "@/lib/modules/emails/unsubscribe-apply";

export const metadata: Metadata = { title: "Se désinscrire des e-mails", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ t?: string; fait?: string; erreur?: string }> };

/**
 * E-mails — page ouverte par le lien « Ne plus recevoir ces e-mails ». Le lien seul ne change rien
 * (les antivirus et aperçus de liens l'ouvrent) : il faut confirmer. Les e-mails essentiels (billet, reçu,
 * contrat, sécurité) continuent d'arriver.
 */
export default async function UnsubscribePage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t.slice(0, 400) : "";
  const target = readUnsubscribeToken(token);
  return (
    <Screen group="visit" index={8} className="vscreen on" mobileOnly>
      <section className="vsec">
        <div className="wrap" style={{ maxWidth: 620 }}>
          <div className="eyebrow">E-mails du club</div>
          {!target ? (
            <>
              <h1 className="h-sec">Lien expiré ou incomplet</h1>
              <p className="lead">Ce lien de désinscription n’est pas valable. Tu peux régler tous tes e-mails depuis tes notifications.</p>
              <p>
                <Link className="btn btn-ink" href="/connexion?suite=/espace/notifications">
                  Régler mes notifications
                </Link>
              </p>
            </>
          ) : sp.fait ? (
            <>
              <h1 className="h-sec">C’est noté</h1>
              <p className="lead">
                Tu ne recevras plus d’e-mails « {target.label} ». La notification reste visible dans l’appli. Les e-mails essentiels (billet, reçu, contrat, sécurité du compte) continuent d’arriver.
              </p>
              <p>
                <Link className="btn btn-ghost" href="/connexion?suite=/espace/notifications">
                  Régler les autres notifications
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="h-sec">Ne plus recevoir ces e-mails ?</h1>
              <p className="lead">Tu ne recevras plus d’e-mails « {target.label} ». Tu pourras les réactiver à tout moment dans tes notifications.</p>
              {sp.erreur && <p className="muted">La désinscription n’a pas fonctionné. Réessaie dans un instant.</p>}
              <form action={unsubscribeAction} className="btn-row">
                <input type="hidden" name="t" value={token} />
                <button className="btn btn-ink" type="submit">
                  Me désinscrire
                </button>
                <Link className="btn btn-ghost" href="/">
                  Garder ces e-mails
                </Link>
              </form>
            </>
          )}
        </div>
      </section>
    </Screen>
  );
}
