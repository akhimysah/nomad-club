"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { demoReply, markThreadRead, sendMessage } from "@/app/actions/messages";
import type { ChatMsg, ChatTarget } from "@/lib/chat";
import { normalize } from "@/lib/format";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toasts";

export type DirPerson = { id: string; name: string; firstName: string; job: string; country: string; since: string | null; badge: "Fondatrice" | "Premium" | null };
export type ThreadItem = { id: string; name: string; last: string; lastMine: boolean; unread: boolean; time: string };
export type CercleTab = "salon" | "annuaire" | "messages";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Bubble({ m }: { m: ChatMsg }) {
  return (
    <div className={"msg" + (m.mine ? " me" : "")}>
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
            </>
          )}
        </div>
        <p>{m.body}</p>
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

/** Fil de discussion (salon ou message privé) : envoi réel, réponse simulée en démo, actualisation en mode réel. */
function Chat({ target, messages, demo, placeholder, empty, dayLabel }: { target: ChatTarget; messages: ChatMsg[]; demo: boolean; placeholder: string; empty?: string; dayLabel?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [extra, setExtra] = useState<ChatMsg[]>([]);
  const [typing, setTyping] = useState<{ name: string; founder: boolean } | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const all = useMemo(() => {
    const map = new Map(messages.map((m) => [m.id, m]));
    extra.forEach((m) => map.has(m.id) || map.set(m.id, m));
    return [...map.values()].sort((a, b) => (a.at < b.at ? -1 : 1));
  }, [messages, extra]);

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
    if (!demo) return;
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
          <Bubble key={m.id} m={m} />
        ))}
        {typing && <Typing name={typing.name} founder={typing.founder} />}
      </div>
      <form className="composer" onSubmit={submit}>
        <div className="ask-field">
          <label className="sr" htmlFor={target.kind === "general" ? "salon-input" : "dm-input"}>
            {target.kind === "general" ? "Message au salon" : "Message privé"}
          </label>
          <input id={target.kind === "general" ? "salon-input" : "dm-input"} autoComplete="off" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          <button className="send" aria-label="Envoyer" disabled={sending}>
            <Icon name="send" />
          </button>
        </div>
      </form>
    </>
  );
}

/** Cercle : salon Général, annuaire filtrable, messages privés. */
export function Cercle({
  tab: initialTab,
  salon,
  salonDay,
  directory,
  threads,
  thread,
  activeCount,
  premiumCount,
  demo,
}: {
  tab: CercleTab;
  salon: ChatMsg[];
  salonDay: string;
  directory: DirPerson[];
  threads: ThreadItem[];
  thread: { other: DirPerson; messages: ChatMsg[] } | null;
  activeCount: number;
  premiumCount: number;
  demo: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<CercleTab>(thread ? "messages" : initialTab);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "Premium" | "Fondatrice" | "Membre">("all");
  const [person, setPerson] = useState<DirPerson | null>(null);
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

  const list = directory.filter((d) => {
    const okF = filter === "all" || (filter === "Membre" ? d.badge === null : d.badge === filter);
    const nq = normalize(q.trim());
    return okF && (!nq || normalize(`${d.name} ${d.job} ${d.country}`).includes(nq));
  });
  const chips: Array<[typeof filter, string, number]> = [
    ["all", "Toutes", directory.length],
    ["Premium", "Premium", directory.filter((d) => d.badge === "Premium").length],
    ["Fondatrice", "Fondatrices", directory.filter((d) => d.badge === "Fondatrice").length],
    ["Membre", "Membres", directory.filter((d) => d.badge === null).length],
  ];

  return (
    <div className="c-wrap">
      <div className="scr-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">Cercle</div>
          <h1 className="scr-title">Le salon, l’annuaire, tes messages</h1>
        </div>
      </div>
      <div className="seg" role="tablist" ref={seg}>
        <span className="seg-ind" aria-hidden="true" style={ind ? { width: ind.w, transform: `translateX(${ind.x - 4}px)` } : { opacity: 0 }} />
        {(["salon", "annuaire", "messages"] as const).map((t) => (
          <button key={t} role="tab" data-c={t} aria-selected={tab === t} className={tab === t ? "on" : undefined} onClick={() => choose(t)}>
            {t === "salon" ? "Salon" : t === "annuaire" ? "Annuaire" : "Messages"}
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
          <Chat target={{ kind: "general" }} messages={salon} demo={demo} placeholder="Écrire au salon Général…" dayLabel={salonDay} />
        </div>
      )}

      {tab === "annuaire" && (
        <div className="c-pane on">
          <div className="dir-tools">
            <label className="search">
              <Icon name="search" />
              <span className="sr">Chercher une membre</span>
              <input id="dir-search" autoComplete="off" placeholder="Chercher un prénom, un métier…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className="chips-row">
              {chips.map(([k, label, n]) => (
                <button key={k} className={"fchip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
                  {label}
                  <small>{n}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="chat-log" style={{ gap: 0, paddingTop: 0 }}>
            <div className="dir-list">
              {list.length ? (
                list.map((d, i) => (
                  <button key={d.id} className="person" style={{ animation: `fadeIn .4s ${Math.min(i, 20) * 0.03}s both` }} onClick={() => setPerson(d)}>
                    <Avatar name={d.name} founder={d.badge === "Fondatrice"} />
                    <span style={{ minWidth: 0 }}>
                      <b>{d.name}</b>
                      <span className="sub">
                        {d.job} · {d.country}
                      </span>
                    </span>
                    {d.badge && (
                      <span className="chip gold">
                        {d.badge === "Premium" && <Icon name="crown" />}
                        {d.badge}
                      </span>
                    )}
                    <Icon name="chev-r" className="go" />
                  </button>
                ))
              ) : (
                <div className="empty">
                  <Icon name="search" />
                  Personne ne correspond. Essaie un autre mot.
                </div>
              )}
              <p className="dir-note">
                {activeCount} adhérentes actives, dont {premiumCount} Premium. L’annuaire complet est visible par les membres.
              </p>
            </div>
          </div>
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
            <Chat target={{ kind: "dm", otherId: thread.other.id }} messages={thread.messages} demo={demo} placeholder="Écrire un message…" empty="Nouvelle conversation" />
          </div>
        </div>
      )}

      <Sheet open={!!person} onClose={() => setPerson(null)} label={person?.name ?? "Membre"}>
        {person && (
          <div style={{ textAlign: "center" }}>
            <Avatar name={person.name} founder={person.badge === "Fondatrice"} className="lg" />
            <h2 className="sh-title" style={{ marginTop: 14 }}>
              {person.name}
            </h2>
            <p className="sh-sub" style={{ marginBottom: 12 }}>
              {person.job}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
              <span className="chip">{person.country}</span>
              {person.since && <span className="chip">À Marrakech depuis {person.since}</span>}
              {person.badge && <span className="chip gold">{person.badge}</span>}
            </div>
            <Link className="btn btn-gold btn-block" href={`/espace/cercle/${person.id}`} onClick={() => setPerson(null)}>
              <Icon name="chat" />
              Écrire à {person.firstName}
            </Link>
            <p className="fine">Messages privés entre membres.</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
