"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveWidgetPrefsAction } from "@/app/actions/engagement";
import type { IconName } from "@/components/IconSprite";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toasts";
import type { WidgetId } from "@/lib/modules/engagement/types";
import { EIcon } from "./EIcon";

export type CustomizerItem = { id: WidgetId; label: string; hint: string; icon: IconName; mandatory: boolean; enabled: boolean };

/**
 * « Personnaliser l'accueil » : activer / désactiver les widgets facultatifs et réordonner tous les widgets.
 * Glisser-déposer à la poignée (souris et doigt), boutons Monter / Descendre, ou flèches du clavier sur la poignée.
 */
export function WidgetCustomizer({ items, defaults }: { items: CustomizerItem[]; defaults: CustomizerItem[] }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(items);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<{ id: WidgetId; dy: number } | null>(null);
  const [live, setLive] = useState("");
  const rows = useRef(new Map<WidgetId, HTMLLIElement>());
  const start = useRef<{ y: number; base: number }>({ y: 0, base: 0 });
  const router = useRouter();
  const toast = useToast();

  const move = (from: number, to: number, announce = true) => {
    if (to < 0 || to >= list.length || from === to) return;
    setList((l) => {
      const next = [...l];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
    if (announce) setLive(`${list[from].label} : position ${to + 1} sur ${list.length}`);
  };
  const toggle = (id: WidgetId) => setList((l) => l.map((w) => (w.id === id && !w.mandatory ? { ...w, enabled: !w.enabled } : w)));

  const onPointerDown = (e: React.PointerEvent, id: WidgetId) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, base: 0 };
    setDrag({ id, dy: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const i = list.findIndex((w) => w.id === drag.id);
    let dy = e.clientY - start.current.y - start.current.base;
    const me = rows.current.get(drag.id);
    const h = (me?.offsetHeight ?? 60) + 8;
    // on échange avec la voisine dès qu'on dépasse la moitié de sa hauteur
    if (dy > h / 2 && i < list.length - 1) {
      move(i, i + 1, false);
      start.current.base += h;
      dy -= h;
    } else if (dy < -h / 2 && i > 0) {
      move(i, i - 1, false);
      start.current.base -= h;
      dy += h;
    }
    setDrag({ id: drag.id, dy });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const i = list.findIndex((w) => w.id === drag.id);
    setLive(`${list[i]?.label} : position ${i + 1} sur ${list.length}`);
    setDrag(null);
  };

  const save = async () => {
    setBusy(true);
    const r = await saveWidgetPrefsAction(list.map(({ id, enabled }) => ({ id, enabled })));
    setBusy(false);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) {
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => {
          setList(items);
          setOpen(true);
        }}
      >
        <Icon name="grid" />
        Personnaliser
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Personnaliser mon accueil">
        <div className="eyebrow">Mon accueil</div>
        <h2 className="sh-title">Personnaliser</h2>
        <p className="sh-sub">Active les widgets qui te servent et range-les dans l’ordre que tu préfères. Les trois essentiels restent toujours affichés.</p>
        <p className="sr" aria-live="polite">
          {live}
        </p>
        <ul className="wz-list" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {list.map((w, i) => (
            <li
              key={w.id}
              ref={(el) => {
                if (el) rows.current.set(w.id, el);
                else rows.current.delete(w.id);
              }}
              className={"wz-row" + (drag?.id === w.id ? " dragging" : "") + (w.enabled ? "" : " off")}
              style={drag?.id === w.id ? { transform: `translateY(${drag.dy}px)` } : undefined}
            >
              <button
                type="button"
                className="wz-handle"
                aria-label={`Déplacer ${w.label} (flèches haut et bas)`}
                onPointerDown={(e) => onPointerDown(e, w.id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    move(i, i - 1);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    move(i, i + 1);
                  }
                }}
              >
                <EIcon name="drag" />
              </button>
              <span className="wz-txt">
                <b>{w.label}</b>
                <span>{w.hint}</span>
              </span>
              <span className="wz-move">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Monter ${w.label}`}>
                  <EIcon name="up" />
                </button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label={`Descendre ${w.label}`}>
                  <EIcon name="down" />
                </button>
              </span>
              {w.mandatory ? (
                <span className="wz-lock">Toujours affiché</span>
              ) : (
                <input type="checkbox" className="pref-switch" checked={w.enabled} onChange={() => toggle(w.id)} aria-label={`Afficher ${w.label}`} />
              )}
            </li>
          ))}
        </ul>
        <div className="btn-row">
          <button className="btn btn-gold" onClick={save} disabled={busy}>
            {busy ? <span className="spin" /> : <Icon name="check" />}
            Enregistrer
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setList(defaults)}>
            <Icon name="refresh" />
            Par défaut
          </button>
        </div>
        <p className="fine">Sur ordinateur, les grands blocs restent à gauche et les cartes à droite, dans cet ordre.</p>
      </Sheet>
    </>
  );
}
