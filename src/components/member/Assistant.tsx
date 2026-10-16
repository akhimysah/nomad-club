"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { askAssistant } from "@/app/actions/assistant";
import { AI_SUGGESTIONS } from "@/lib/content";
import type { AiAction } from "@/lib/domain/assistant";
import { TicketSheet } from "../events/TicketSheet";
import { Icon } from "../ui/Icon";
import type { TicketData } from "../ui/Ticket";

type Item = { id: number; me: boolean; text: string; actions?: AiAction[]; ticket?: TicketData | null };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Mark() {
  return (
    <span className="ai-mark" style={{ width: 34, height: 34, borderRadius: 11 }}>
      <img src="/img/monogramme-clair.png" alt="" style={{ height: 20 }} />
    </span>
  );
}

/** Assistant du club : questions libres ou suggestions, réponses avec boutons d'action. */
export function Assistant({ firstName, initialQuestion, demo }: { firstName: string; initialQuestion: string | null; demo: boolean }) {
  const [items, setItems] = useState<Item[]>([
    { id: 0, me: false, text: `Bonjour ${firstName}. Je connais le carnet d’adresses et l’agenda du club. Pose ta question, je réponds tout de suite.` },
  ]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const seq = useRef(1);
  const asked = useRef(false);

  useLayoutEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length, typing]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question) return;
    setItems((l) => [...l, { id: seq.current++, me: true, text: question }]);
    const pending = askAssistant(question);
    await wait(350);
    setTyping(true);
    const [r] = await Promise.all([pending, wait(1100)]);
    setTyping(false);
    setItems((l) => [...l, { id: seq.current++, me: false, text: r.text, actions: r.actions, ticket: r.ticket }]);
  };

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    let q = initialQuestion;
    try {
      q = sessionStorage.getItem("nc:ask") ?? q;
      sessionStorage.removeItem("nc:ask");
    } catch {
      /* stockage indisponible */
    }
    if (q) void ask(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="c-wrap">
      <div className="ai-intro">
        <div className="ai-mark">
          <img src="/img/monogramme-clair.png" alt="" />
        </div>
        <div>
          <h1 className="h-display" style={{ fontSize: 30 }}>
            Une question ?
          </h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 15.5 }}>
            Je réponds avec le carnet et l’agenda du club.{demo ? " Réponses simulées." : ""}
          </p>
        </div>
      </div>
      <div className="chat-log" ref={log} aria-live="polite">
        {items.map((it) =>
          it.me ? (
            <div key={it.id} className="msg me">
              <div className="bubble">
                <p>{it.text}</p>
              </div>
            </div>
          ) : (
            <div key={it.id} className="msg">
              <Mark />
              <div className="bubble">
                <div className="who">Assistant du club</div>
                <p>{it.text}</p>
                {it.actions && it.actions.length > 0 && (
                  <div className="ai-actions">
                    {it.actions.map((a) =>
                      a.ticket ? (
                        <button key={a.label} className="btn btn-ghost btn-xs" onClick={() => setTicket(it.ticket ?? null)} disabled={!it.ticket}>
                          {a.label}
                        </button>
                      ) : (
                        <Link key={a.label} className="btn btn-ghost btn-xs" href={a.href ?? "/espace"}>
                          {a.label}
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {typing && (
          <div className="msg">
            <Mark />
            <div className="bubble">
              <div className="typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="sugg">
        {AI_SUGGESTIONS.map((s) => (
          <button key={s} className="fchip" onClick={() => void ask(s)}>
            {s}
          </button>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const q = text;
          setText("");
          void ask(q);
        }}
      >
        <div className="ask-field">
          <label className="sr" htmlFor="ai-input">
            Ta question
          </label>
          <input id="ai-input" autoComplete="off" placeholder="Visa, banque, école, brunch…" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
          <button className="send" aria-label="Envoyer">
            <Icon name="send" />
          </button>
        </div>
      </form>
      <TicketSheet open={!!ticket} onClose={() => setTicket(null)} ticket={ticket} demo={demo} />
    </div>
  );
}
