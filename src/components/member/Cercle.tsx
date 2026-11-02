"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { moderateMessageAction } from "@/app/actions/communaute";
import { demoReply, markThreadRead, sendMessage } from "@/app/actions/messages";
import type { ChatMsg, ChatTarget } from "@/lib/chat";
import { HIDDEN_LABEL } from "@/lib/modules/communaute/domain";
import type { DirectoryEntry } from "@/lib/modules/communaute/types";
import type { GroupItem } from "@/lib/modules/communaute/views";
import { Annuaire } from "../communaute/Annuaire";
import { GroupList } from "../communaute/Groups";
import { ReportSheet } from "../communaute/ReportSheet";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

export type DirPerson = { id: string; name: string; firstName: string; job: string; country: string; since: string | null; badge: "Fondatrice" | "Premium" | null };
export type ThreadItem = { id: string; name: string; last: string; lastMine: boolean; unread: boolean; time: string };
export type CercleTab = "salon" | "groupes" | "annuaire" | "messages";

/** Lot 1 : actions possibles sur une bulle (signaler, modérer). */
type BubbleActions = { onReport?: (m: ChatMsg) => void; onModerate?: (m: ChatMsg) => void };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Bubble({ m, onReport, onModerate }: { m: ChatMsg } & BubbleActions) {
  return (
    <div className={"msg" + (m.mine ? " me" : "") + (m.hidden ? " cm-hidden" : "")}>
      {!m.mine && <Avatar name={m.author} founder={m.founder} />}
      <div className="bubble">
        <div className="who">
          {m.mine ? (
            <>
              <time>{m.time}</time>Toi
            </>
          ) : (
            <>
              {m.author}
              {m.founder && <span className="chip solid">Fondatrice</span>}
              <time>{m.time}</time>
              {onReport && !m.hidden && (
                <button type="button" className="cm-flag" onClick={() => onReport(m)} aria-label={`Signaler le message de ${m.author}`}>
                  Signaler
                </button>
              )}
            </>
          )}
          {onModerate && (
            <button type="button" className="cm-flag" onClick={() => onModerate(m)}>
              {m.hidden ? "Rétablir" : "Masquer"}
            </button>
          )}
        </div>
        <p>{m.hidden ? HIDDEN_LABEL : m.body}</p>
      </div>
    </div>
  );
}

function Typing({ name, founder }: { name: string; founder: boolean }) {
  return (
    <div className="msg">
      <Avatar name={name} founder={founder} />
      <div className="bubble">
        <div className="typing">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

/**
 * Fil de discussion (salon, message privé ou groupe) : envoi réel, réponse simulée en démo, actualisation en mode réel.
 * Lot 1 : signalement par les membres, masquer / rétablir pour la modération.
 */
export function Chat({
  target,
  messages,
  demo,
  placeholder,
  empty,
  dayLabel,
  canModerate,
}: {
  target: ChatTarget;
  messages: ChatMsg[];
  demo: boolean;
  placeholder: string;
  empty?: string;
  dayLabel?: string;
  canModerate?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [extra, setExtra] = useState<ChatMsg[]>([]);
  const [hiddenOverride, setHiddenOverride] = useState<Record<string, boolean>>({});
  const [reporting, setReporting] = useState<ChatMsg | null>(null);
  const [typing, setTyping] = useState<{ name: string; founder: boolean } | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const all = useMemo(() => {
    const map = new Map(messages.map((m) => [m.id, m]));
    extra.forEach((m) => map.has(m.id) || map.set(m.id, m));
    return [...map.values()].map((m) => (m.id in hiddenOverride ? { ...m, hidden: hiddenOverride[m.id] } : m)).sort((a, b) => (a.at < b.at ? -1 : 1));
  }, [messages, extra, hiddenOverride]);

  const moderate = async (m: ChatMsg) => {
    const kind = m.hidden ? "restore" : "hide";
    const r = await moderateMessageAction(m.id, kind);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) {
      setHiddenOverride((o) => ({ ...o, [m.id]: kind === "hide" }));
      router.refresh();
    }
  };

  useLayoutEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [all.length, typing]);

  useEffect(() => {
    if (demo) return;
    const id = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(id);
  }, [demo, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    const r = await sendMessage(target, body);
    setSending(false);
    if (!r.ok) {
      toast(r.error, "bell");
      setText(body);
      return;
    }
    setExtra((x) => [...x, r.msg]);
    if (r.notice) toast(r.notice, "lock");
    if (!demo || r.msg.hidden) return;
    const t0 = Date.now();
    const reply = await demoReply(target);
    if (!reply) return;
    await wait(Math.max(0, 700 - (Date.now() - t0)));
    setTyping({ name: reply.author, founder: reply.founder });
    await wait(1500);
    setTyping(null);
    setExtra((x) => [...x, reply]);
  };

  return (
    <>
      <div className="chat-log" ref={log} aria-live="polite">
        {dayLabel && all.length > 0 && <span className="day-sep">{dayLabel}</span>}
        {all.length === 0 && empty && <span className="day-sep">{empty}</span>}
        {all.map((m) => (
          <Bubble key={m.id} m={m} onReport={!m.mine ? setReporting : undefined} onModerate={canModerate ? moderate : undefined} />
        ))}
        {typing && <Typing name={typing.name} founder={typing.founder} />}
      </div>
      <form className="composer" onSubmit={submit}>
        <div className="ask-field">
          <label className="sr" htmlFor={target.kind === "general" ? "salon-input" : `${target.kind}-input`}>
            {target.kind === "general" ? "Message au salon" : target.kind === "group" ? "Message au groupe" : "Message privé"}
          </label>
          <input id={target.kind === "general" ? "salon-input" : `${target.kind}-input`} autoComplete="off" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          <button className="send" aria-label="Envoyer" disabled={sending}>
            <Icon name="send" />
          </button>
        </div>
      </form>
      <ReportSheet target={reporting ? { id: reporting.id, author: reporting.author, body: reporting.body } : null} onClose={() => setReporting(null)} />
    </>
  );
}

/** Cercle : salon Général, groupes thématiques (Lot 1), annuaire filtrable, messages privés. */
export function Cercle({
  tab: initialTab,
  salon,
  salonDay,
  entries,
  groups,
  threads,
  thread,
  activeCount,
  premiumCount,
  demo,
  canModerate,
}: {
  tab: CercleTab;
  salon: ChatMsg[];
  salonDay: string;
  /** Lot 1 : fiches d'annuaire (confidentialité appliquée). */
  entries: DirectoryEntry[];
  /** Lot 1 : groupes thématiques visibles. */
  groups: GroupItem[];
  threads: ThreadItem[];
  thread: { other: DirPerson; messages: ChatMsg[] } | null;
  activeCount: number;
  premiumCount: number;
  demo: boolean;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<CercleTab>(thread ? "messages" : initialTab);
  const seg = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ w: number; x: number } | null>(null);
  const unread = threads.filter((t) => t.unread).length;

  useLayoutEffect(() => {
    const measure = () => {
      const b = seg.current?.querySelector<HTMLButtonElement>(`button[data-c="${tab}"]`);
      if (b && b.offsetWidth) setInd({ w: b.offsetWidth, x: b.offsetLeft });
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [tab]);

  const otherId = thread?.other.id;
  useEffect(() => {
    if (otherId) void markThreadRead(otherId);
  }, [otherId]);

  const choose = (t: CercleTab) => {
    setTab(t);
    if (thread) {
      router.push(`/espace/cercle?onglet=${t}`);
      return;
    }
    try {
      window.history.replaceState(null, "", t === "salon" ? "/espace/cercle" : `/espace/cercle?onglet=${t}`);
    } catch {
      /* sans importance */
    }
  };

  return (
    <div className="c-wrap">
      <div className="scr-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">Cercle</div>
          <h1 className="scr-title">Le salon, les groupes, l’annuaire, tes messages</h1>
        </div>
      </div>
      <div className="seg" role="tablist" ref={seg}>
        <span className="seg-ind" aria-hidden="true" style={ind ? { width: ind.w, transform: `translateX(${ind.x - 4}px)` } : { opacity: 0 }} />
        {(["salon", "groupes", "annuaire", "messages"] as const).map((t) => (
          <button key={t} role="tab" data-c={t} aria-selected={tab === t} className={tab === t ? "on" : undefined} onClick={() => choose(t)}>
            {t === "salon" ? "Salon" : t === "groupes" ? "Groupes" : t === "annuaire" ? "Annuaire" : "Messages"}
            {t === "messages" && unread > 0 && <span className="nbadge">{unread}</span>}
          </button>
        ))}
      </div>

      {tab === "salon" && (
        <div className="c-pane on">
          <div className="chat-head">
            <span>
              <b>Général</b> · {activeCount} adhérentes
            </span>
            <span>Bienveillance de rigueur</span>
          </div>
          <Chat target={{ kind: "general" }} messages={salon} demo={demo} placeholder="Écrire au salon Général…" dayLabel={salonDay} canModerate={canModerate} />
        </div>
      )}

      {tab === "groupes" && (
        <div className="c-pane on">
          <GroupList groups={groups} />
        </div>
      )}

      {tab === "annuaire" && (
        <div className="c-pane on">
          <Annuaire entries={entries} activeCount={activeCount} premiumCount={premiumCount} />
        </div>
      )}

      {tab === "messages" && !thread && (
        <div className="c-pane on">
          <div className="chat-log" style={{ gap: 0 }}>
            <div className="dir-list">
              {threads.length ? (
                threads.map((t) => (
                  <Link key={t.id} href={`/espace/cercle/${t.id}`} className="person dm-item">
                    <Avatar name={t.name} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <b>{t.name}</b>
                      <span className="last">
                        {t.lastMine ? "Toi : " : ""}
                        {t.last}
                      </span>
                    </span>
                    {t.unread ? (
                      <span className="unread" aria-label="Non lu" />
                    ) : (
                      <span className="muted" style={{ fontSize: 13 }}>
                        {t.time}
                      </span>
                    )}
                  </Link>
                ))
              ) : (
                <div className="empty">
                  <Icon name="chat" />
                  Pas encore de message. Écris à une membre depuis l’annuaire.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "messages" && thread && (
        <div className="c-pane on">
          <div className="thread-wrap">
            <div className="thread-head">
              <Link className="icon-btn" href="/espace/cercle?onglet=messages" aria-label="Retour aux messages">
                <Icon name="chev-l" />
              </Link>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={thread.other.name} founder={thread.other.badge === "Fondatrice"} />
                <b style={{ font: "500 20px var(--serif)" }}>{thread.other.name}</b>
              </span>
            </div>
            <Chat
              target={{ kind: "dm", otherId: thread.other.id }}
              messages={thread.messages}
              demo={demo}
              placeholder="Écrire un message…"
              empty="Nouvelle conversation"
              canModerate={canModerate}
            />
          </div>
        </div>
      )}

    </div>
  );
}
