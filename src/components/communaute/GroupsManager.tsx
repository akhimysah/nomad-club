"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { archiveGroupAction, decideGroupRequestAction, saveGroupAction } from "@/app/actions/communaute";
import { GROUP_ICON_LABEL } from "@/lib/modules/communaute/domain";
import { GROUP_ICONS, type GroupIcon, type JoinPolicy } from "@/lib/modules/communaute/types";
import type { GroupItem } from "@/lib/modules/communaute/views";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toasts";

export type RequestItem = { groupId: string; groupName: string; profileId: string; name: string; job: string | null; time: string };

type Draft = { id?: string; name: string; description: string; icon: GroupIcon; joinPolicy: JoinPolicy; listed: boolean };
const EMPTY: Draft = { name: "", description: "", icon: "users", joinPolicy: "open", listed: true };

function GroupEditor({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [d, setD] = useState<Draft>(draft ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await saveGroupAction({ name: d.name, description: d.description, icon: d.icon, joinPolicy: d.joinPolicy, listed: d.listed }, d.id);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast(r.message, "check");
    onClose();
    router.refresh();
  };
  const access: Array<[string, string, string, () => void, boolean]> = [
    ["open", "Ouvert", "Chaque membre entre librement.", () => setD({ ...d, joinPolicy: "open", listed: true }), d.joinPolicy === "open"],
    ["request", "Sur demande", "Visible, la modération valide.", () => setD({ ...d, joinPolicy: "request", listed: true }), d.joinPolicy === "request" && d.listed],
    ["private", "Privé", "Invisible, sur invitation.", () => setD({ ...d, joinPolicy: "request", listed: false }), !d.listed],
  ];
  return (
    <form className="cm-form" onSubmit={save}>
      <h2 className="sh-title">{d.id ? "Modifier le groupe" : "Nouveau groupe"}</h2>
      <p className="sh-sub" style={{ marginBottom: 18 }}>
        Un groupe thématique pour échanger entre deux rendez-vous.
      </p>
      <div className="field">
        <label htmlFor="g-name">Nom</label>
        <input id="g-name" value={d.name} maxLength={80} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Club de lecture" required />
      </div>
      <div className="field">
        <label htmlFor="g-desc">Description</label>
        <textarea id="g-desc" className="sm" value={d.description} maxLength={400} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="De quoi parle-t-on dans ce groupe ?" />
      </div>
      <div className="field" style={{ marginBottom: 6 }}>
        <label>Icône</label>
      </div>
      <div className="cm-icons" role="radiogroup" aria-label="Icône du groupe">
        {GROUP_ICONS.map((ic) => (
          <button key={ic} type="button" role="radio" aria-checked={d.icon === ic} aria-label={GROUP_ICON_LABEL[ic]} title={GROUP_ICON_LABEL[ic]} className={d.icon === ic ? "on" : undefined} onClick={() => setD({ ...d, icon: ic })}>
            <Icon name={ic} />
          </button>
        ))}
      </div>
      <div className="field" style={{ marginBottom: 6 }}>
        <label>Accès</label>
      </div>
      <div className="cm-choice three" role="radiogroup" aria-label="Accès au groupe">
        {access.map(([k, label, hint, pick, on]) => (
          <button key={k} type="button" role="radio" aria-checked={on} className={on ? "on" : undefined} onClick={pick}>
            <b>{label}</b>
            <span>{hint}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="err-msg" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}
      <button className="btn btn-gold btn-block" disabled={busy || d.name.trim().length < 2}>
        {busy && <span className="spin" />}
        {d.id ? "Enregistrer" : "Créer le groupe"}
      </button>
    </form>
  );
}

function RequestRow({ r }: { r: RequestItem }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const decide = async (approve: boolean) => {
    setBusy(true);
    const res = await decideGroupRequestAction(r.groupId, r.profileId, approve);
    setBusy(false);
    toast(res.ok ? res.message : res.error, res.ok ? "check" : "bell");
    if (res.ok) router.refresh();
  };
  return (
    <div className="cm-row">
      <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Avatar name={r.name} />
        <span style={{ minWidth: 0 }}>
          <b>{r.name}</b>
          <span className="sub">
            {r.groupName} · {r.job ?? "Membre"} · {r.time}
          </span>
        </span>
      </span>
      <span className="cm-acts">
        <button type="button" className="btn btn-ink btn-xs" disabled={busy} onClick={() => decide(true)}>
          Accepter
        </button>
        <button type="button" className="btn btn-ghost btn-xs" disabled={busy} onClick={() => decide(false)}>
          Refuser
        </button>
      </span>
    </div>
  );
}

/** Lot 1 — Gestion des groupes (administratrices et modératrices) : création, accès, demandes, archivage. */
export function GroupsManager({ groups, requests }: { groups: GroupItem[]; requests: RequestItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Draft | null>(null);
  const archive = async (g: GroupItem) => {
    const r = await archiveGroupAction(g.id, !g.archivedAt);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) router.refresh();
  };
  return (
    <>
      <section className="card">
        <div className="card-h">
          <h2>Demandes en attente</h2>
          <span className="muted">
            {requests.length} demande{requests.length > 1 ? "s" : ""}
          </span>
        </div>
        {requests.length ? (
          requests.map((r) => <RequestRow key={r.groupId + r.profileId} r={r} />)
        ) : (
          <div className="empty">
            <Icon name="check" />
            Aucune demande à valider.
          </div>
        )}
      </section>
      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-h">
          <h2>Groupes</h2>
          <button type="button" className="btn btn-ink btn-sm" onClick={() => setEditing({ ...EMPTY })}>
            <Icon name="plus" />
            Nouveau groupe
          </button>
        </div>
        {groups.map((g) => (
          <div key={g.id} className="cm-row" style={g.archivedAt ? { opacity: 0.55 } : undefined}>
            <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <span className="plus-item" style={{ padding: 0 }}>
                <span className="so-ic">
                  <Icon name={g.icon} />
                </span>
              </span>
              <span style={{ minWidth: 0 }}>
                <b>{g.name}</b>
                <span className="sub">
                  {g.memberCount} membre{g.memberCount > 1 ? "s" : ""} · {g.joinPolicy === "open" ? "ouvert" : "sur demande"}
                  {!g.listed ? " · privé" : ""}
                  {g.pendingCount ? ` · ${g.pendingCount} en attente` : ""}
                  {g.archivedAt ? " · archivé" : ""}
                </span>
              </span>
            </span>
            <span className="cm-acts">
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setEditing({ id: g.id, name: g.name, description: g.description, icon: g.icon, joinPolicy: g.joinPolicy, listed: g.listed })}
              >
                <Icon name="edit" />
                Modifier
              </button>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => archive(g)}>
                {g.archivedAt ? "Rouvrir" : "Archiver"}
              </button>
            </span>
          </div>
        ))}
      </section>
      <Sheet open={!!editing} onClose={() => setEditing(null)} label="Groupe">
        {editing && <GroupEditor key={editing.id ?? "new"} draft={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}
