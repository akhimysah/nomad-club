import type { Metadata } from "next";
import Link from "next/link";
import { MyContracts } from "@/components/contrats/MyContracts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { toMyItems } from "@/lib/modules/contrats/views";
import "@/styles/contrats.css";

export const metadata: Metadata = { title: "Mes contrats" };
export const dynamic = "force-dynamic";

/** Vague 2 · Contrats — « Mes contrats » (membre) : contrats d'adhésion, acceptation en ligne, PDF, certificat. */
export default async function MesContratsPage() {
  const v = await requireMember("/espace/moi/contrats");
  const list = (await getRepo().listMyContracts(v.profile.id)).filter((c) => c.kind === "membership" && c.profileId === v.profile.id);
  const pending = list.filter((c) => c.status === "pending").length;
  return (
    <Screen group="member" index={5} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <div className="eyebrow">Moi</div>
            <h1 className="scr-title">Mes contrats</h1>
          </div>
          <Link className="btn btn-ghost btn-sm" href="/espace/moi">
            <Icon name="chev-l" />
            Ma carte
          </Link>
        </div>
        {pending > 0 && (
          <div className="flash" style={{ marginBottom: 18 }}>
            <Icon name="edit" />
            {pending === 1 ? "Un contrat attend ton accord." : `${pending} contrats attendent ton accord.`}
          </div>
        )}
        <section className="card">
          <h2 className="h-sm" style={{ marginBottom: 4 }}>
            Adhésion
          </h2>
          <MyContracts items={toMyItems(list)} empty="Aucun contrat pour l’instant. Ton contrat d’adhésion apparaîtra ici après ta souscription." />
        </section>
        <section className="card" style={{ marginTop: 20 }}>
          <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
            Chaque contrat est accepté en ligne. Nous conservons la date, l’heure, l’adresse IP, le navigateur, la version du contrat et l’empreinte numérique du PDF ; le certificat d’acceptation récapitule cette preuve. Une question ? Écris à Julia et Nora.
          </p>
        </section>
      </div>
    </Screen>
  );
}
