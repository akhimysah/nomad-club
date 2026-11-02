"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { switchSpace } from "@/app/actions/space";
import { SPACE_ORDER as ORDER, type Space } from "@/lib/permissions";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { lastPath, rememberPath, SPACES, spaceOf } from "./spaces";

/** Bandeau du haut (mode démo) : aperçu privé, choix de l'espace, date du jour. */
export function Switcher({ dateLabel }: { dateLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const cur = spaceOf(pathname);
  const [optimistic, setOptimistic] = useState<Space | null>(null);
  const shown = optimistic ?? cur;
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const segRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ w: number; x: number } | null>(null);

  useEffect(() => {
    rememberPath(cur, pathname);
    setOptimistic(null);
  }, [cur, pathname]);

  useLayoutEffect(() => {
    const measure = () => {
      const b = segRef.current?.querySelector<HTMLButtonElement>(`button[data-space="${shown}"]`);
      if (b) setInd({ w: b.offsetWidth, x: b.offsetLeft });
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [shown]);

  const go = (s: Space) => {
    setOpen(false);
    if (s === cur) return;
    setOptimistic(s);
    start(async () => {
      await switchSpace(s);
      router.push(lastPath(s));
    });
  };

  return (
    <>
      <header id="switcher">
        <div className="sw-note">
          <span className="dot" />
          <span className="txt">
            <span>Aperçu privé</span>
            <span className="sep">&nbsp;·&nbsp;</span>
            <span>données d’exemple</span>
          </span>
        </div>
        <div className="sw-seg" role="tablist" aria-label="Choisir l’espace" ref={segRef}>
          <span className="sw-ind" aria-hidden="true" style={ind ? { width: ind.w, transform: `translateX(${ind.x}px)` } : undefined} />
          {ORDER.map((s) => (
            <button key={s} role="tab" data-space={s} aria-selected={s === shown} className={s === shown ? "on" : undefined} onClick={() => go(s)}>
              <b>{SPACES[s].label}</b>
              <small>{SPACES[s].sub}</small>
            </button>
          ))}
        </div>
        <div className="sw-date">{dateLabel}</div>
        <button className="sw-mobile" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <span>
            <b>{SPACES[shown].label}</b>
            <small>{SPACES[shown].sub}</small>
          </span>
          <Icon name="chev-d" />
        </button>
      </header>
      <Sheet open={open} onClose={() => setOpen(false)} label="Changer d’espace">
        <div className="eyebrow">Aperçu privé · données d’exemple</div>
        <h2 className="sh-title">Changer d’espace</h2>
        <p className="sh-sub">Vois l’appli comme une visiteuse, une membre, une partenaire, une pro ou une fondatrice.</p>
        {ORDER.map((s) => (
          <button key={s} className={"space-opt" + (s === shown ? " on" : "")} onClick={() => go(s)}>
            <span className="so-ic">
              <Icon name={SPACES[s].icon} />
            </span>
            <span>
              <b>{SPACES[s].label}</b>
              <small>{SPACES[s].sub}</small>
            </span>
            <Icon name="check" className="chk" />
          </button>
        ))}
      </Sheet>
    </>
  );
}
