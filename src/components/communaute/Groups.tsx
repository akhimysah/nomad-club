"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { joinGroupAction, leaveGroupAction } from "@/app/actions/communaute";
import type { GroupItem } from "@/lib/modules/communaute/views";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

export function JoinButton({ group, className = "btn btn-gold btn-xs" }: { group: Pick<GroupItem, "id" | "joinPolicy" | "myStatus" | "name">; className?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (group.myStatus === "pending")
    return (
      <span className="chip">
        <Icon name="clock" />
        Demande envoyée
      </span>
    );
  const join = async () => {
    setBusy(true);
    const r = await joinGroupAction(group.id);
    setBusy(false);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) router.refresh();
  };
  return (
    <button type="button" className={className} onClick={join} disabled={busy}>
      {busy && <span className="spin" />}
      {group.joinPolicy === "open" ? "Rejoindre" : "Demander à rejoindre"}
    </button>
  );
}

export function LeaveButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Quitter ce groupe ?")) return;
        setBusy(true);
        const r = await leaveGroupAction(groupId);
        setBusy(false);
        toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
        if (r.ok) router.push("/espace/cercle?onglet=groupes");
      }}
    >
      Quitter
    </button>
  );
}

/** Lot 1 — Groupes thématiques : les miens d'abord, puis ceux à rejoindre. */
export function GroupList({ groups }: { groups: GroupItem[] }) {
  const mine = groups.filter((g) => g.myStatus === "member");
  const others = groups.filter((g) => g.myStatus !== "member");
  const card = (g: GroupItem) => (
    <div key={g.id} className="cm-group">
      <div className="top">
        <span className="gic">
          <Icon name={g.icon} />
        </span>
        <span style={{ minWidth: 0 }}>
          <b>{g.name}</b>
          <span className="sub">
            {g.memberCount} membre{g.memberCount > 1 ? "s" : ""}
            {g.joinPolicy === "request" ? " · sur demande" : " · ouvert"}
            {!g.listed ? " · privé" : ""}
          </span>
        </span>
      </div>
      {g.description && <p>{g.description}</p>}
      <div className="foot">
        {g.myStatus === "member" ? (
          <>
            <span className="sub">{g.lastLabel ? `Dernier message : ${g.lastLabel}` : "Pas encore de message"}</span>
            <Link className="btn btn-gold btn-xs" href={`/espace/cercle/groupes/${g.slug}`}>
              Ouvrir <Icon name="arrow-r" />
            </Link>
          </>
        ) : (
          <>
            <span className="sub">{g.joinPolicy === "request" ? "La modération valide les demandes." : "Entrée libre."}</span>
            <JoinButton group={g} />
          </>
        )}
      </div>
    </div>
  );
  return (
    <div className="chat-log" style={{ gap: 0, paddingTop: 0 }}>
      {mine.length > 0 && (
        <>
          <div className="mini-h" style={{ marginTop: 18 }}>
            Mes groupes
          </div>
          <div className="cm-groups" style={{ paddingTop: 8 }}>
            {mine.map(card)}
          </div>
        </>
      )}
      <div className="mini-h" style={{ marginTop: mine.length ? 0 : 18 }}>
        {mine.length ? "À découvrir" : "Les groupes du club"}
      </div>
      {others.length ? (
        <div className="cm-groups" style={{ paddingTop: 8 }}>
          {others.map(card)}
        </div>
      ) : (
        <div className="empty">
          <Icon name="check" />
          Tu fais partie de tous les groupes ouverts.
        </div>
      )}
    </div>
  );
}
