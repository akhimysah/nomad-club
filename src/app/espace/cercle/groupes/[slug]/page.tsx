import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinButton, LeaveButton } from "@/components/communaute/Groups";
import { Chat } from "@/components/member/Cercle";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireMember, viewerCan } from "@/lib/auth";
import { toChatMsg } from "@/lib/chat";
import { getRepo } from "@/lib/data";
import { groupChannel } from "@/lib/modules/communaute/domain";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Groupe · ${decodeURIComponent((await params).slug)}` };
}

/** Lot 1 — Un groupe thématique : la conversation pour ses membres, la présentation pour les autres. */
export default async function GroupPage({ params }: Props) {
  const { slug } = await params;
  const v = await requireMember(`/espace/cercle/groupes/${slug}`);
  const repo = getRepo();
  const moderates = viewerCan(v, "messages.moderate");
  const g = await repo.getGroup(decodeURIComponent(slug), v.profile.id, { manage: moderates });
  if (!g) notFound();
  const member = g.myStatus === "member";
  const canRead = member || moderates;
  const [messages, members] = canRead ? await Promise.all([repo.listMessages(groupChannel(g.id)), repo.listGroupMembers(g.id)]) : [[], []];
  const people = members.filter((m) => m.status === "member");
  return (
    <Screen group="member" index={2} className="mscreen chat on">
      <div className="c-wrap">
        <div className="thread-head">
          <Link className="icon-btn" href="/espace/cercle?onglet=groupes" aria-label="Retour aux groupes">
            <Icon name="chev-l" />
          </Link>
          <span className="cm-group" style={{ padding: 0, background: "none", boxShadow: "none", flex: 1, minWidth: 0 }}>
            <span className="top">
              <span className="gic">
                <Icon name={g.icon} />
              </span>
              <span style={{ minWidth: 0 }}>
                <b style={{ font: "500 20px var(--serif)" }}>{g.name}</b>
                <span className="sub">
                  {g.memberCount} membre{g.memberCount > 1 ? "s" : ""} · {g.joinPolicy === "open" ? "ouvert" : "sur demande"}
                  {!g.listed ? " · privé" : ""}
                </span>
              </span>
            </span>
          </span>
          {member && <LeaveButton groupId={g.id} />}
        </div>
        {canRead ? (
          <div className="cm-gwrap">
            {g.description && (
              <div className="chat-head">
                <span>{g.description}</span>
                <span className="desk-only">{people.slice(0, 4).map((m) => m.profile.firstName).join(", ")}{people.length > 4 ? "…" : ""}</span>
              </div>
            )}
            {!member && <p className="cm-note">Tu lis ce groupe en tant que modératrice.</p>}
            {member ? (
              <Chat
                target={{ kind: "group", groupId: g.id }}
                messages={messages.map((m) => toChatMsg(m, m.author, v.profile.id))}
                demo={v.mode === "demo"}
                placeholder={`Écrire au groupe ${g.name}…`}
                empty="Pas encore de message : lance la conversation !"
                canModerate={moderates}
              />
            ) : (
              <div className="chat-log">
                {messages.map((m) => {
                  const c = toChatMsg(m, m.author, v.profile.id);
                  return (
                    <div key={c.id} className={"msg" + (c.hidden ? " cm-hidden" : "")}>
                      <div className="bubble">
                        <div className="who">
                          {c.author}
                          <time>{c.time}</time>
                        </div>
                        <p>{c.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="card lock-card" style={{ marginTop: 24 }}>
            <Icon name="lock" />
            <h2 className="sh-title">{g.myStatus === "pending" ? "Ta demande est en attente" : "Rejoins le groupe pour lire la conversation"}</h2>
            <p className="sh-sub">{g.description}</p>
            <JoinButton group={g} className="btn btn-gold" />
          </div>
        )}
      </div>
    </Screen>
  );
}
