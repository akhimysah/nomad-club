import Link from "next/link";
import { money } from "@/lib/format";
import type { MembershipState } from "@/lib/views";
import type { PayEnv } from "../events/CheckoutSheet";
import { Icon } from "../ui/Icon";
import { MembershipButton } from "./Buttons";

/** Carte « Mon adhésion » de l'accueil : anneau des jours restants, renouvellement. */
export function AdhesionCard({ m, env }: { m: MembershipState; env: PayEnv }) {
  const C = 2 * Math.PI * 42;
  const pct = m.renewed ? 1 : Math.min(1, m.days / 365);
  return (
    <section className="card adh-card">
      <div className="row-head">
        <h2 className="h-sm">Mon adhésion</h2>
        <span className="chip gold">
          {m.premium && <Icon name="crown" />}
          {m.premium ? "Premium" : "Membre"}
        </span>
      </div>
      <div className="adh-row">
        <div className="ring">
          <svg viewBox="0 0 96 96">
            <circle className="ring-bg" cx="48" cy="48" r="42" fill="none" strokeWidth="6" />
            <circle className="ring-fg" cx="48" cy="48" r="42" fill="none" strokeWidth="6" strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - pct)).toFixed(1)} />
          </svg>
          <div>
            <b>{m.days}</b>
            <span>jours</span>
          </div>
        </div>
        <p>
          {m.expired ? (
            <>Ta formule {m.premium ? "Premium" : "Membre"} est arrivée à échéance.</>
          ) : (
            <>
              Ta formule {m.premium ? "Premium" : "Membre"} se termine le <b>{m.endsLong}</b>
              {m.renewed ? "." : `, dans ${m.days} jours.`}
            </>
          )}
          <br />
          <span className="muted">{money(m.price)} par an</span>
        </p>
      </div>
      <div className="btn-row">
        {m.renewed ? (
          <span className="chip gold">
            <Icon name="check" />
            Renouvelée
          </span>
        ) : m.pending ? (
          <span className="chip">Virement en attente</span>
        ) : (
          <MembershipButton kind="renew" plan={m.plan} amount={m.price} env={env} className="btn btn-gold btn-sm">
            Renouveler
          </MembershipButton>
        )}
        <Link className="btn btn-ghost btn-sm" href="/espace/moi">
          Ma carte et mon adhésion
        </Link>
      </div>
    </section>
  );
}
