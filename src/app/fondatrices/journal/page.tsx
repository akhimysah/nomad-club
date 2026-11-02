import type { Metadata } from "next";
import { FHead } from "@/components/founders/parts";
import { Avatar } from "@/components/ui/Avatar";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { dayMonthShort, fullName, hour } from "@/lib/format";
import type { AuditAction } from "@/lib/types";

export const metadata: Metadata = { title: "Journal des opérations" };
export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<AuditAction, string> = {
  "payment.validate": "Virement validé",
  "event.create": "Rendez-vous créé",
  "event.update": "Rendez-vous modifié",
  "event.publish": "Rendez-vous publié",
  "role.grant": "Rôle ajouté",
  "role.revoke": "Rôle retiré",
  "reminder.send": "Relance",
  // --- Lot 1 ---
  "news.create": "Publication créée",
  "news.update": "Publication modifiée",
  "news.publish": "Publication publiée",
  "news.delete": "Publication supprimée",
  "group.create": "Groupe créé",
  "group.update": "Groupe modifié",
  "group.decide": "Demande de groupe",
  "moderation.hide": "Message masqué",
  "moderation.restore": "Message rétabli",
  "moderation.warn": "Avertissement",
  "moderation.dismiss": "Signalement classé",
  "keyword.add": "Mot-clé ajouté",
  "keyword.remove": "Mot-clé retiré",
  "event.remind": "Rappels J-1",
};

/** Journal des opérations importantes (lecture seule). */
export default async function JournalPage() {
  await requireCapability("audit.view", { next: "/fondatrices/journal" });
  const repo = getRepo();
  const [log, profiles] = await Promise.all([repo.listAudit({ limit: 200 }), repo.listProfiles()]);
  const names = new Map(profiles.map((p) => [p.id, fullName(p)]));
  return (
    <Screen group="founders" index={7} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Journal des opérations" sub="Qui a fait quoi, et quand" />
        <section className="card">
          <ul className="log">
            {log.map((e) => {
              const who = (e.actorId && names.get(e.actorId)) || "Système";
              return (
                <li key={e.id}>
                  <Avatar name={who} founder={who !== "Système"} />
                  <span>
                    <b>{e.summary}</b>
                    <span>
                      {ACTION_LABEL[e.action] ?? e.action} · par {who}
                    </span>
                  </span>
                  <time>
                    {dayMonthShort(e.createdAt)} · {hour(e.createdAt)}
                  </time>
                </li>
              );
            })}
            {!log.length && <li className="empty">Le journal est vide.</li>}
          </ul>
        </section>
      </div>
    </Screen>
  );
}
