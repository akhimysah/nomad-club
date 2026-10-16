"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

const subscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/**
 * Feuille de la maquette : fenêtre centrée sur ordinateur, feuille du bas sur téléphone
 * (poignée à tirer vers le bas pour fermer, Échap, clic sur le fond).
 */
export function Sheet({
  open,
  onClose,
  children,
  label = "Fenêtre",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  const isClient = useIsClient();
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [day, setDay] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);
  const drag = useRef<{ y0: number | null; dy: number }>({ y0: null, dy: 0 });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement;
      setDay(document.body.classList.contains("is-day"));
      setMounted(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setShow(true));
      });
      const t = setTimeout(() => {
        const f = bodyRef.current?.querySelector<HTMLElement>("input, select, textarea, button");
        f?.focus({ preventScroll: true });
      }, 380);
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
        clearTimeout(t);
      };
    }
    setShow(false);
    const t = setTimeout(() => setMounted(false), 420);
    const lf = lastFocus.current as HTMLElement | null;
    if (lf && typeof lf.focus === "function") {
      try {
        lf.focus({ preventScroll: true });
      } catch {
        /* rien */
      }
    }
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!isClient || !mounted) return null;

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { y0: e.clientY, dy: 0 };
    sheetRef.current?.classList.add("dragging");
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current.y0 == null) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y0);
    sheetRef.current?.style.setProperty("--dy", drag.current.dy + "px");
  };
  const onUp = () => {
    if (drag.current.y0 == null) return;
    drag.current.y0 = null;
    sheetRef.current?.classList.remove("dragging");
    if (drag.current.dy > 110) onClose();
    else sheetRef.current?.style.setProperty("--dy", "0px");
  };

  return createPortal(
    <div className={"sheet-wrap open" + (show ? " show" : "")}>
      <div className="backdrop" onClick={onClose} />
      <div ref={sheetRef} className={"sheet" + (day ? " day" : "")} role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" aria-hidden="true" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        <button className="sh-close" type="button" aria-label="Fermer" onClick={onClose}>
          <Icon name="x" />
        </button>
        <div className="sheet-body" ref={bodyRef}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
