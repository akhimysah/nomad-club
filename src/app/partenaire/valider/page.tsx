import type { Metadata } from "next";
import { FHead } from "@/components/founders/parts";
import { NoOrg } from "@/components/partenaires/OrgBlocks";
import { ValidateCodeForm } from "@/components/partenaires/OrgForms";
import { Screen } from "@/components/ui/Screen";
import { getRepo } from "@/lib/data";
import { normalizeOfferCode } from "@/lib/modules/partenaires/domain";
import { loadOrgContext } from "@/lib/modules/partenaires/server";

export const metadata: Metadata = { title: "Valider un code" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ code?: string }> };

const at = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Validation au comptoir : saisie, scan, ou lien ouvert par le QR de la membre (?code=). */
export default async function Page({ searchParams }: Props) {
  const { code } = await searchParams;
  const { orgs } = await loadOrgContext("partner", "/partenaire/valider");
  const repo = getRepo();
  const today = await Promise.all(orgs.map((o) => repo.listOrgCodes(o.organization.id, { validatedOnly: true, limit: 10 })));
  const offers = (await Promise.all(orgs.map((o) => repo.listOffers({ organizationId: o.organization.id })))).flat();
  const recent = today.flat().sort((a, b) => ((a.validatedAt ?? "") < (b.validatedAt ?? "") ? 1 : -1)).slice(0, 10);
  return (
    <Screen group="partner" index={2} className="fscreen scroller on">
      <div className="f-inner" style={{ maxWidth: 860 }}>
        <FHead title="Valider un code" sub="Au comptoir, en un geste" />
        {!orgs.length ? (
          <NoOrg />
        ) : (
          <div className="f-col">
            <ValidateCodeForm initialCode={code ? (normalizeOfferCode(code) ?? code) : ""} />
            <section className="card">
              <div className="card-h">
                <h2>Derniers codes validés</h2>
              </div>
              <ul className="mini-list">
                {recent.map((c) => (
                  <li key={c.id}>
                    <span>
                      <b>{c.code}</b> · {offers.find((o) => o.id === c.offerId)?.title ?? "Offre"}
                    </span>
                    <span>{c.validatedAt ? at(c.validatedAt) : ""}</span>
                  </li>
                ))}
              </ul>
              {!recent.length && <div className="empty">Aucun code validé pour l’instant.</div>}
            </section>
          </div>
        )}
      </div>
    </Screen>
  );
}
