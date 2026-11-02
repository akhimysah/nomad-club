import type { Metadata } from "next";
import Link from "next/link";
import { ProfileEditor } from "@/components/communaute/ProfileEditor";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";
import { getRepo } from "@/lib/data";

export const metadata: Metadata = { title: "Ma fiche" };
export const dynamic = "force-dynamic";

/** Lot 1 — Ma fiche d'annuaire : profil complet et confidentialité. */
export default async function MyProfilePage() {
  const v = await requireMember("/espace/moi/profil");
  const p = v.profile;
  const d = await getRepo().getDirectoryProfile(p.id);
  const initial = {
    firstName: p.firstName,
    lastName: p.lastName,
    job: p.job,
    country: p.country,
    marrakechSince: p.marrakechSince,
    bio: p.bio,
    whatsapp: p.whatsapp,
    avatarUrl: p.avatarUrl,
    company: d?.company ?? null,
    sector: d?.sector ?? null,
    skills: (d?.skills ?? []).join(", "),
    instagram: d?.instagram ?? null,
    linkedin: d?.linkedin ?? null,
    website: d?.website ?? null,
    lookingFor: d?.lookingFor ?? null,
    offering: d?.offering ?? null,
    visibility: d?.visibility ?? "all",
    showWhatsapp: d?.showWhatsapp ?? false,
    showEmail: d?.showEmail ?? false,
  };
  return (
    <Screen group="member" index={5} className="mscreen scroller on">
      <div className="m-inner">
        <div className="scr-head">
          <div>
            <Link className="link" href="/espace/moi">
              <Icon name="chev-l" /> Moi
            </Link>
            <h1 className="scr-title">Ma fiche</h1>
            <p className="scr-sub">C’est elle qui permet aux autres membres de te trouver dans l’annuaire.</p>
          </div>
          <Link className="btn btn-ghost btn-sm" href="/espace/cercle?onglet=annuaire">
            Voir l’annuaire
          </Link>
        </div>
        <ProfileEditor initial={initial} email={p.email} />
      </div>
    </Screen>
  );
}
