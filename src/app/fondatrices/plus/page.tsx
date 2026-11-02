import type { Metadata } from "next";
import Link from "next/link";
import { FOUNDER_NAV } from "@/components/founders/nav";
import { FHead } from "@/components/founders/parts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";

export const metadata: Metadata = { title: "Plus" };
export const dynamic = "force-dynamic";

const HINT: Record<string, string> = {
  "/fondatrices/crm": "Contacts, pipeline prospects, tâches, segments et statistiques.",
  "/fondatrices/roles": "Donner ou retirer un rôle, voir qui peut faire quoi.",
  "/fondatrices/journal": "Les opérations importantes : qui, quoi, quand.",
  "/fondatrices/notifications": "Vos notifications et vos préférences.",
  // --- Lot 4 ---
  "/fondatrices/boutique": "Guides et ressources digitales : produits, fichiers, ventes.",
  "/fondatrices/parrainage": "Parrainages, récompenses à remettre, réglages.",
  "/fondatrices/business": "Deals entre membres, retombées du réseau, barème des points.",
};

/** Téléphone : les entrées de l'espace fondatrices qui n'ont pas d'onglet dans la barre du bas. */
export default async function FounderMorePage() {
  const v = await requireCapability("space.admin", { next: "/fondatrices/plus" });
  const notifs = await getRepo().countUnreadNotifications(v.profile.id);
  return (
    <Screen group="founders" index={9} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Plus" sub="Pilotage et administration" />
        <div className="plus-list">
          {FOUNDER_NAV.filter((n) => !n.mobile).map((n) => (
            <Link key={n.href} href={n.href} className="card plus-item">
              <span className="so-ic">
                <Icon name={n.icon} />
              </span>
              <span>
                <b>{n.label}</b>
                <span>{HINT[n.href]}</span>
              </span>
              {n.href === "/fondatrices/notifications" && notifs > 0 ? <span className="nbadge">{notifs}</span> : <Icon name="chev-r" />}
            </Link>
          ))}
        </div>
      </div>
    </Screen>
  );
}
