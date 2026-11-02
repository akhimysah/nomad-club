"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import type { StoryGroup, StorySlide } from "@/lib/modules/engagement/stories";

const DUR = 5000;
/** Les slides avec du texte restent un peu plus longtemps. */
const durOf = (s: StorySlide) => (s.text || s.people.length ? 6500 : DUR);
const ANIM = 360;

type Props = {
  groups: StoryGroup[];
  start: number;
  seen: Set<string>;
  onSeen: (id: string) => void;
  /** Bulle d'origine (pour l'animation d'ouverture / de fermeture et le retour du focus). */
  originOf: (gi: number) => HTMLElement | null;
  onGroupChange: (gi: number) => void;
  onClose: () => void;
};

type Phase = "opening" | "open" | "closing";

const firstUnseen = (g: StoryGroup, seen: Set<string>) => Math.max(0, g.slides.findIndex((s) => !seen.has(s.id)));

const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/** Transformation qui ramène la carte sur la bulle d'origine (null si la bulle n'est pas visible). */
function toOrigin(card: HTMLElement, origin: HTMLElement | null): string | null {
  if (!origin) return null;
  const o = origin.getBoundingClientRect();
  if (o.width === 0 || o.bottom < 0 || o.top > window.innerHeight || o.right < 0 || o.left > window.innerWidth) return null;
  // Rectangle de la carte sans transformation en cours.
  const c = { left: card.offsetLeft, top: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
  const s = o.width / c.width;
  const dx = o.left + o.width / 2 - (c.left + c.width / 2);
  const dy = o.top + o.height / 2 - (c.top + c.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${s})`;
}

/** Visionneuse plein écran façon Instagram (portail sur document.body). */
export function StoryViewer({ groups, start, seen, onSeen, originOf, onGroupChange, onClose }: Props) {
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(() => firstUnseen(groups[start], seen));
  const [phase, setPhase] = useState<Phase>("opening");
  const [held, setHeld] = useState(false);
  const [kbPaused, setKbPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const [rm] = useState(reducedMotion);

  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const elapsed = useRef(0);
  const seenRef = useRef(seen);
  seenRef.current = seen;

  const group = groups[gi];
  const slide = group.slides[Math.min(si, group.slides.length - 1)];
  const running = phase === "open" && !held && !kbPaused && !hidden;

  /* ---------- fermeture ---------- */
  const finish = useCallback(() => {
    const btn = originOf(gi)?.closest("button");
    onClose();
    // Retour du focus sur la bulle.
    requestAnimationFrame(() => btn?.focus({ preventScroll: true }));
  }, [gi, onClose, originOf]);

  const close = useCallback(() => {
    if (phase === "closing") return;
    const card = cardRef.current;
    if (rm || !card) return finish();
    setPhase("closing");
    const target = toOrigin(card, originOf(gi));
    card.style.transition = `transform ${ANIM}ms var(--out), opacity ${ANIM}ms var(--ease), border-radius ${ANIM}ms var(--out)`;
    card.style.transform = target ?? "translateY(40px) scale(.86)";
    card.style.borderRadius = target ? "50%" : "";
    card.style.opacity = "0";
    if (backRef.current) backRef.current.style.opacity = "0";
    window.setTimeout(finish, ANIM);
  }, [finish, gi, originOf, phase, rm]);

  /* ---------- navigation ---------- */
  const goGroup = useCallback(
    (n: number, d: 1 | -1) => {
      setDir(d);
      setGi(n);
      setSi(firstUnseen(groups[n], seenRef.current));
      onGroupChange(n);
    },
    [groups, onGroupChange],
  );

  const next = useCallback(() => {
    if (si < group.slides.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) goGroup(gi + 1, 1);
    else close();
  }, [close, gi, goGroup, group.slides.length, groups.length, si]);

  const prev = useCallback(() => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) goGroup(gi - 1, -1);
    else {
      // Première slide : on la relance.
      elapsed.current = 0;
    }
  }, [gi, goGroup, si]);

  const nextRef = useRef(next);
  nextRef.current = next;

  /* ---------- ouverture (la carte part de la bulle) ---------- */
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || rm) {
      setPhase("open");
      return;
    }
    const from = toOrigin(card, originOf(start));
    card.style.transition = "none";
    card.style.transform = from ?? "scale(.9)";
    card.style.borderRadius = from ? "50%" : "";
    card.style.opacity = from ? "0.6" : "0";
    void card.offsetWidth;
    card.style.transition = `transform ${ANIM + 60}ms var(--out), opacity ${ANIM}ms var(--ease), border-radius ${ANIM + 60}ms var(--out)`;
    card.style.transform = "";
    card.style.borderRadius = "";
    card.style.opacity = "";
    const t = window.setTimeout(() => {
      card.style.transition = "";
      setPhase("open");
    }, ANIM + 60);
    return () => window.clearTimeout(t);
    // Seulement au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- barres de progression : remise à zéro à chaque slide ---------- */
  useEffect(() => {
    elapsed.current = 0;
    onSeen(slide.id);
    const bars = barsRef.current?.children;
    if (bars) {
      for (let i = 0; i < bars.length; i++) {
        const fill = bars[i].firstElementChild as HTMLElement | null;
        if (fill) fill.style.transform = `scaleX(${i < si ? 1 : 0})`;
      }
    }
    // Précharge l'image suivante.
    const nx = group.slides[si + 1] ?? groups[gi + 1]?.slides[0];
    if (nx?.image) {
      const img = new Image();
      img.src = nx.image;
    }
  }, [gi, si, slide.id, onSeen, group.slides, groups]);

  /* ---------- minuterie (rAF, sans re-rendu à chaque image) ---------- */
  useEffect(() => {
    if (!running) return;
    const dur = durOf(slide);
    const fill = barsRef.current?.children[si]?.firstElementChild as HTMLElement | null | undefined;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      const p = Math.min(1, elapsed.current / dur);
      if (fill) fill.style.transform = `scaleX(${p})`;
      if (p >= 1) nextRef.current();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, si, gi, slide]);

  /* ---------- onglet masqué ---------- */
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* ---------- défilement bloqué derrière ---------- */
  useEffect(() => {
    const els = [document.body, ...Array.from(document.querySelectorAll<HTMLElement>(".scroller"))];
    const prevs = els.map((el) => el.style.overflow);
    els.forEach((el) => (el.style.overflow = "hidden"));
    document.documentElement.classList.add("st-lock");
    closeBtnRef.current?.focus({ preventScroll: true });
    return () => {
      els.forEach((el, i) => (el.style.overflow = prevs[i]));
      document.documentElement.classList.remove("st-lock");
    };
  }, []);

  /* ---------- clavier : flèches, Échap, espace, piège à focus ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === " " && !(e.target as HTMLElement | null)?.closest("a,button")) {
        e.preventDefault();
        setKbPaused((p) => !p);
      } else if (e.key === "Tab") {
        const f = rootRef.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
        if (!f || f.length === 0) return;
        const first = f[0];
        const lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        } else if (!rootRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, next, prev]);

  /* ---------- gestes : tap gauche / droite, appui long, glisser bas / côtés ---------- */
  const g = useRef<{ x: number; y: number; t: number; id: number; mode: null | "down" | "x" | "none"; long: boolean; timer: number } | null>(null);

  const springBack = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = `transform .35s var(--out)`;
    card.style.transform = "";
    if (backRef.current) {
      backRef.current.style.transition = "opacity .35s var(--ease)";
      backRef.current.style.opacity = "";
    }
    window.setTimeout(() => {
      if (card) card.style.transition = "";
    }, 360);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== "open" || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("a,button")) return;
    const timer = window.setTimeout(() => {
      if (g.current) g.current.long = true;
      setHeld(true);
    }, 220);
    g.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, mode: null, long: false, timer };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.mode === null && Math.hypot(dx, dy) > 10) {
      window.clearTimeout(s.timer);
      s.mode = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "down" : "none") : "x";
      setHeld(true);
    }
    const card = cardRef.current;
    if (!card) return;
    if (s.mode === "down") {
      const d = Math.max(0, dy);
      card.style.transition = "none";
      card.style.transform = `translate(${dx * 0.3}px, ${d}px) scale(${Math.max(0.78, 1 - d / 1400)})`;
      if (backRef.current) {
        backRef.current.style.transition = "none";
        backRef.current.style.opacity = String(Math.max(0.15, 1 - d / 500));
      }
    } else if (s.mode === "x") {
      const edge = (dx > 0 && gi === 0) || (dx < 0 && gi === groups.length - 1);
      card.style.transition = "none";
      card.style.transform = `translateX(${edge ? dx * 0.35 : dx}px) rotate(${dx / 60}deg)`;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    g.current = null;
    window.clearTimeout(s.timer);
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const fast = performance.now() - s.t < 260;
    setHeld(false);
    if (s.mode === "down") {
      if (dy > 110 || (fast && dy > 50)) close();
      else springBack();
      return;
    }
    if (s.mode === "x") {
      const card = cardRef.current;
      const go = Math.abs(dx) > 70 || (fast && Math.abs(dx) > 30);
      if (go && dx < 0 && gi < groups.length - 1) {
        if (card) card.style.transform = "";
        goGroup(gi + 1, 1);
      } else if (go && dx > 0 && gi > 0) {
        if (card) card.style.transform = "";
        goGroup(gi - 1, -1);
      } else if (go && dx < 0) close();
      else springBack();
      return;
    }
    if (s.mode === null && !s.long) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (e.clientX - r.left < r.width / 3) prev();
      else next();
    }
  };

  const onPointerCancel = () => {
    const s = g.current;
    if (s) window.clearTimeout(s.timer);
    g.current = null;
    setHeld(false);
    springBack();
  };

  const paused = held || kbPaused || hidden;

  return createPortal(
    <div
      ref={rootRef}
      className={"sv" + (paused ? " paused" : "") + (phase === "closing" ? " closing" : "") + (rm ? " rm" : "")}
      role="dialog"
      aria-modal="true"
      aria-label={`Story : ${group.label}`}
    >
      <div ref={backRef} className="sv-back" onClick={close} aria-hidden="true" />
      <button type="button" className="sv-nav prev" onClick={() => (gi > 0 ? goGroup(gi - 1, -1) : prev())} aria-label="Story précédente" disabled={gi === 0 && si === 0}>
        <Icon name="chev-l" />
      </button>
      <div ref={cardRef} className="sv-card">
        <div key={group.id} className={"sv-group " + (dir > 0 ? "in-next" : "in-prev")}>
          <div className="sv-stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
            <Visual key={slide.id} slide={slide} dur={durOf(slide)} />
            <div className="sv-veil" aria-hidden="true" />

            <div className="sv-top">
              <div className="sv-bars" ref={barsRef} aria-hidden="true">
                {group.slides.map((s) => (
                  <span key={s.id} className="sv-bar">
                    <i />
                  </span>
                ))}
              </div>
              <div className="sv-head">
                <span className={"sv-mini" + (group.cover.image ? "" : " noimg")} aria-hidden="true">
                  {group.cover.image ? (
                    <img src={group.cover.image} alt="" style={{ objectPosition: group.cover.position || "50% 50%" }} />
                  ) : group.cover.initials ? (
                    <Avatar name={group.cover.initials} />
                  ) : group.cover.icon ? (
                    <Icon name={group.cover.icon} />
                  ) : null}
                </span>
                <span className="sv-who">
                  <b>{group.label}</b>
                  <small>Nomad Club</small>
                </span>
                <span className="sv-pause" aria-hidden="true" data-on={paused ? "1" : "0"}>
                  <i />
                  <i />
                </span>
                <button ref={closeBtnRef} type="button" className="sv-close" onClick={close} aria-label="Fermer la story">
                  <Icon name="x" />
                </button>
              </div>
            </div>

            <div key={`b-${slide.id}`} className="sv-body">
              <span className="sr">
                Story {si + 1} sur {group.slides.length}.
              </span>
              <span className="sv-eyebrow">{slide.eyebrow}</span>
              <h2 className="sv-title">{slide.title}</h2>
              {slide.text && <p className="sv-text">{slide.text}</p>}
              {slide.meta.length > 0 && (
                <ul className="sv-meta">
                  {slide.meta.map((m, i) => (
                    <li key={i}>
                      <Icon name={m.icon} />
                      {m.text}
                    </li>
                  ))}
                </ul>
              )}
              {slide.people.length > 0 && (
                <ul className="sv-people">
                  {slide.people.map((p, i) => (
                    <li key={p.id} style={{ "--i": i } as React.CSSProperties}>
                      <Link href={p.href} onClick={finish}>
                        <span className="sv-pp">{p.photo ? <img src={p.photo} alt="" /> : <Avatar name={p.name} />}</span>
                        <span className="sv-pn">
                          <b>{p.name}</b>
                          {p.job && <small>{p.job}</small>}
                        </span>
                        <Icon name="chat" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {slide.chip && (
                <span className={"sv-chip " + slide.chip.tone}>
                  {slide.chip.tone === "booked" && <Icon name="check" />}
                  {slide.chip.text}
                </span>
              )}
              {slide.cta && (
                <Link className="btn btn-gold sv-cta" href={slide.cta.href} onClick={finish}>
                  {slide.cta.label} <Icon name="arrow-r" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
      <button type="button" className="sv-nav next" onClick={() => (gi < groups.length - 1 ? goGroup(gi + 1, 1) : close())} aria-label="Story suivante">
        <Icon name="chev-r" />
      </button>
    </div>,
    document.body,
  );
}

/** Image plein cadre avec effet Ken Burns (ou fond monogramme sans photo). */
function Visual({ slide, dur }: { slide: StorySlide; dur: number }) {
  if (!slide.image)
    return (
      <div className={"sv-img noimg k-" + slide.kind} aria-hidden="true">
        <img className="sv-mono" src="/img/monogramme-clair.png" alt="" />
      </div>
    );
  return (
    <div className="sv-img" aria-hidden="true" style={{ "--dur": `${dur + 1200}ms` } as React.CSSProperties}>
      <img src={slide.image} alt="" style={{ objectPosition: slide.imagePosition || "50% 50%" }} />
    </div>
  );
}
