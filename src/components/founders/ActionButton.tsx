"use client";

import { useRef, useState } from "react";
import { publishDraftAction, remindAction, validateAllAction, validatePaymentAction, type FounderResult } from "@/app/actions/founders";
import type { IconName } from "../IconSprite";
import { Icon } from "../ui/Icon";
import { markDone } from "../ui/Lingering";
import { useToast } from "../ui/Toasts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 60 : ms));

const CONF = {
  vir: { busy: "Validation", done: "Validé", icon: "check" },
  rel: { busy: "Envoi", done: "Relancée", icon: "send" },
  invite: { busy: "Envoi", done: "Invitée", icon: "send" },
  pub: { busy: "Publication", done: "Publié", icon: "cal" },
} as const satisfies Record<string, { busy: string; done: string; icon: IconName }>;

/**
 * Bouton d'action des fondatrices (Valider, Relancer, Inviter, Publier) :
 * sablier, puis la ligne passe à « Validé » et les compteurs se recalculent.
 */
export function ActionButton({ kind, target, rowKey, label }: { kind: keyof typeof CONF; target: string; rowKey: string; label: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const toast = useToast();
  const ref = useRef<HTMLSpanElement>(null);
  const c = CONF[kind];
  const run = async () => {
    if (state !== "idle") return;
    setState("busy");
    markDone(rowKey);
    const call: Promise<FounderResult> = kind === "vir" ? validatePaymentAction(target) : kind === "pub" ? publishDraftAction(target) : remindAction(target);
    const [r] = await Promise.all([call, wait(700)]);
    if (!r.ok) {
      setState("idle");
      toast(r.error, "bell");
      return;
    }
    setState("done");
    document.querySelectorAll(`[data-row="${CSS.escape(rowKey)}"]`).forEach((el) => el.classList.add("done"));
    toast(r.message, c.icon);
  };
  return (
    <span ref={ref}>
      {state === "done" ? (
        <span className="ok">
          <Icon name="check" />
          {c.done}
        </span>
      ) : (
        <button className="btn btn-ink btn-xs" onClick={run} disabled={state === "busy"}>
          {state === "busy" ? (
            <>
              <span className="spin" />
              {c.busy}
            </>
          ) : (
            label
          )}
        </button>
      )}
    </span>
  );
}

/** « Tout valider » : valide tous les virements déclarés. */
export function ValidateAllButton({ keys }: { keys: string[] }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <button
      className="btn btn-gold btn-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        keys.forEach(markDone);
        const [r] = await Promise.all([validateAllAction(), wait(700)]);
        document.querySelectorAll(keys.map((k) => `[data-row="${CSS.escape(k)}"]`).join(",")).forEach((el) => el.classList.add("done"));
        setBusy(false);
        toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
      }}
    >
      {busy && <span className="spin" />}
      Tout valider
    </button>
  );
}
