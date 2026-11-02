"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import type { StoryGroup } from "@/lib/modules/engagement/stories";
import { StoryViewer } from "./StoryViewer";
import "@/styles/stories.css";

const KEY = "nc-stories-seen";
const MAX = 300;

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSeen(s: Set<string>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...s].slice(-MAX)));
  } catch {
    /* stockage indisponible (navigation privée) : tant pis */
  }
}

export const groupSeen = (g: StoryGroup, seen: Set<string>) => g.slides.every((s) => seen.has(s.id));

/** Rangée de bulles « stories » en haut de l'accueil membre. */
export function Stories({ groups }: { groups: StoryGroup[] }) {
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Lecture après montage (pas de localStorage côté serveur : évite un écart d'hydratation).
  useEffect(() => {
    setSeen(readSeen());
    setReady(true);
  }, []);

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      writeSeen(next);
      return next;
    });
  }, []);

  if (groups.length === 0) return null;

  const originOf = (gi: number) => rowRef.current?.querySelector<HTMLElement>(`[data-story="${groups[gi]?.id}"] .st-ring`) ?? null;

  return (
    <section className="stories" aria-label="Stories du club">
      <div className="st-row" ref={rowRef} role="list">
        {groups.map((g, i) => {
          const done = ready && groupSeen(g, seen);
          return (
            <div key={g.id} role="listitem" className="st-item" style={{ "--i": i } as React.CSSProperties}>
              <button
                type="button"
                className={"st-bubble" + (done ? " seen" : "") + (open === i ? " active" : "")}
                data-story={g.id}
                onClick={() => setOpen(i)}
                aria-label={`${g.label}${g.badge ? ` (${g.badge})` : ""}${done ? ", déjà vue" : ", nouvelle story"}`}
                aria-haspopup="dialog"
              >
                <span className="st-ring">
                  <span className={"st-cover" + (g.cover.image ? "" : " noimg")}>
                    {g.cover.image ? (
                      <img src={g.cover.image} alt="" style={{ objectPosition: g.cover.position || "50% 50%" }} loading={i < 5 ? undefined : "lazy"} />
                    ) : g.cover.initials ? (
                      <Avatar name={g.cover.initials} className="st-av" />
                    ) : g.cover.icon ? (
                      <Icon name={g.cover.icon} />
                    ) : null}
                  </span>
                </span>
                {g.badge && <span className="st-badge">{g.badge}</span>}
                <span className="st-label">{g.label}</span>
              </button>
            </div>
          );
        })}
      </div>
      {open !== null && (
        <StoryViewer
          groups={groups}
          start={open}
          seen={seen}
          onSeen={markSeen}
          originOf={originOf}
          onGroupChange={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
