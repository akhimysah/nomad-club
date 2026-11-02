"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { archiveGroupAction, decideGroupRequestAction, saveGroupAction } from "@/app/actions/communaute";
import { GROUP_ICON_LABEL } from "@/lib/modules/communaute/domain";
import { GROUP_ICONS, type GroupIcon, type GroupView, type JoinPolicy } from "@/lib/modules/communaute/types";
import type { GroupRequestItem } from "@/lib/modules/communaute/views";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toasts";

/** Demandes d'adhésion aux groupes sur demande : accepter ou refuser. */
export function GroupRequests({ requests }: { requests: GroupRequestItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const decide = async (q: GroupRequestItem, approve: boolean) => {
    const key = q.groupId + q.profileId;
    setBusy(key);
    const r = await decideGroupRequestAction(q.groupId, q.profileId, approve);
    setBusy(null);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) {
      setGone((g) => [...g, key]);
      router.refresh();
    }
  };
  const list = requests.filter((q) => !gone.includes(q.groupId + q.profileId));
  return (
    <section className="card">
      <div className="card-h">
        <h2>Demandes en attente</h2>
        <span className="muted">
          {list.length} demande{list.length > 1 ? "s" : ""}
        </span>
      </div>
      {list.length ? (
        <div>
          {list.map((q) => (
            <div key={q.groupId + q.profileId} className="cm-row">
              <span style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                <Avatar name={q.name} />
                <span style={{ minWidth: 0 }}>
                  <b>{q.name}</b>
                  <span className="sub">
                    pour « {q.groupName} » · {q.job ?? "Membre"} · {q.time}
                  </span>
                </span>
              </span>
              <span className="cm-acts">
                <button type="button" className="btn btn-ink btn-xs" disabled={!!busy} onClick={() => decide(q, true)}>
                  {busy === q.groupId + q.profileId && <span className="spin" />}
                  Accepter
                </button>
                <button type="button" className="btn btn-ghost btn-xs" disabled={!!busy} onClick={() => decide(q, false)}>
                  Refuser
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Icon name="check" />
          Aucune demande en attente.
        </div>
      )}
    </section>
  );
}

type GroupDraft = { id?: string; name: string; description: string; icon: GroupIcon; joinPolicy: JoinPolicy; listed: boolean };
const EMPTY: GroupDraft = { name: "", description: "", icon: "users", joinPolicy: "open", listed: true };

function GroupEditor({ draft, onClose }: { draft: GroupDraft | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<GroupDraft>(draft ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [lastDraft, setLastDraft] = useState(draft);
  if (draft !== lastDraft) {
    setLastDraft(draft);
    setF(draft ?? EMPTY);
  }
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { id, ...form } = f;
    const r = await saveGroupAction(form, id);
    setBusy(false);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) {
      onClose();
      router.refresh();
    }
  };
  return (
    <Sheet open={!!draft} onClose={onClose} label={f.id ? "Modifier le groupe" : "Nouveau groupe"}>
      <form className="cm-form" onSubmit={save}>
        <h2 className="sh-title">{f.id ? "Modifier le groupe" : "Nouveau groupe"}</h2>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="g-name">Nom</label>
          <input id="g-name" required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="g-desc">Description</label>
          <textarea id="g-desc" className="sm" maxLength={400} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div className="mini-h">Icône</div>
        <div className="cm-icons">
          {GROUP_ICONS.map((i) => (
            <button key={i} type="button" className={f.icon === i ? "on" : undefined} aria-label={GROUP_ICON_LABEL[i]} aria-pressed={f.icon === i} title={GROUP_ICON_LABEL[i]} onClick={() => setF({ ...f, icon: i })}>
              <Icon name={i} />
            </button>
          ))}
        </div>
        <div className="mini-h">Entrée</div>
        <div className="cm-choice">
          <button type="button" className={f.joinPolicy === "open" ? "on" : undefined} onClick={() => setF({ ...f, joinPolicy: "open" })}>
            <b>Ouvert</b>
            <span>Chaque membre entre librement.</span>
          </button>
          <button type="button" className={f.joinPolicy === "request" ? "on" : undefined} onClick={() => setF({ ...f, joinPolicy: "request" })}>
            <b>Sur demande</b>
            <span>La modération valide chaque demande.</span>
          </button>
        </div>
        <label className="toggle">
          <span>
            Visible dans la liste des groupes
            <span className="muted" style={{ display: "block", fontSize: 13, fontWeight: 500 }}>
              Sinon groupe privé : seules ses membres le voient.
            </span>
          </span>
          <input type="checkbox" checked={f.listed} onChange={(e) => setF({ ...f, listed: e.target.checked })} />
        </label>
        <button className="btn btn-gold btn-block" disabled={busy || f.name.trim().length < 2}>
          {busy ? <span className="spin" /> : <Icon name="check" />}
          {f.id ? "Enregistrer" : "Créer le groupe"}
        </button>
      </form>
    </Sheet>
  );
}

/** Liste des groupes avec création, modification et archivage. `readLinks` : lien vers la conversation (espace membre). */
export function GroupsManager({ groups, readLinks }: { groups: GroupView[]; readLinks?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<GroupDraft | null>(null);
  const archive = async (g: GroupView) => {
    if (!g.archivedAt && !window.confirm(`Archiver « ${g.name} » ? La conversation n’est plus accessible aux membres.`)) return;
    const r = await archiveGroupAction(g.id, !g.archivedAt);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) router.refresh();
  };
  return (
    <section className="card">
      <div className="card-h">
        <h2>Groupes</h2>
        <button type="button" className="btn btn-ink btn-xs" onClick={() => setDraft({ ...EMPTY })}>
          <Icon name="plus" />
          Nouveau groupe
        </button>
      </div>
      <div>
        {groups.map((g) => (
          <div key={g.id} className="cm-row" style={g.archivedAt ? { opacity: 0.55 } : undefined}>
            <span style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
              <span className="gic" style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--s2)", color: "var(--accent)", flex: "none" }}>
                <Icon name={g.icon} />
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
              {readLinks && !g.archivedAt && (
                <Link className="btn btn-ghost btn-xs" href={`/espace/cercle/groupes/${g.slug}`}>
                  Lire
                </Link>
              )}
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setDraft({ id: g.id, name: g.name, description: g.description, icon: g.icon, joinPolicy: g.joinPolicy, listed: g.listed })}>
                Modifier
              </button>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => archive(g)}>
                {g.archivedAt ? "Rouvrir" : "Archiver"}
              </button>
            </span>
          </div>
        ))}
      </div>
      <GroupEditor draft={draft} onClose={() => setDraft(null)} />
    </section>
  );
}
