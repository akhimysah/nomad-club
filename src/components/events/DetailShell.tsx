"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TicketData } from "../ui/Ticket";
import { canGoBack, flyTo, takeFly } from "../ui/fly";
import { Icon } from "../ui/Icon";
import { CheckoutSheet, type CheckoutConfig, type CheckoutEvent, type PayEnv } from "./CheckoutSheet";
import { TicketSheet } from "./TicketSheet";

export type DetailCta =
  | { act: "book"; p: string; s: string; label: string; amount: number }
  | { act: "wait"; p: string; s: string; label: string }
  | { act: "ticket"; p: string; s: string; label: string; ticket: TicketData; pending: boolean; cancelId: string | null }
  | { act: "upgrade"; p: string; s: string; label: string; amount: number }
  | { act: "plans"; p: string; s: string; label: string }
  | { act: "none"; p: string; s: string; label: string };

/**
 * Détail d'un rendez-vous (maquette) : photo à gauche (en haut sur téléphone), contenu qui défile,
 * barre d'action collée en bas. La photo « s'envole » depuis la carte cliquée.
 */
export function DetailShell({
  image,
  imagePosition,
  caption,
  backHref,
  cta,
  ctx,
  event,
  env,
  children,
}: {
  image: string | null;
  imagePosition: string | null;
  caption: string | null;
  backHref: string;
  cta: DetailCta;
  ctx: "visit" | "member";
  event: CheckoutEvent;
  env: PayEnv;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const [checkout, setCheckout] = useState<CheckoutConfig | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);

  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const src = takeFly();
    const img = imgRef.current;
    if (!reduced && src && img) {
      img.style.visibility = "hidden";
      const show = () => (img.style.visibility = "visible");
      requestAnimationFrame(() => flyTo(src, img, show));
      setTimeout(show, 900);
    } else if (!reduced) {
      ref.current?.animate([{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" });
    }
    const t = setTimeout(() => backRef.current?.focus({ preventScroll: true }), 50);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    const d = ref.current;
    const go = () => (canGoBack() ? router.back() : router.push(backHref));
    if (!d || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return go();
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    d.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: mobile ? "translateX(40px)" : "translateY(16px)" }], { duration: 280, easing: "ease-in", fill: "forwards" });
    setTimeout(go, 250);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".sheet-wrap.open")) close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const onCta = () => {
    if (cta.act === "book") setCheckout({ kind: "ticket", ctx, amount: cta.amount, event });
    else if (cta.act === "wait") setCheckout({ kind: "wait", ctx, amount: 0, event });
    else if (cta.act === "upgrade") setCheckout({ kind: "upgrade", ctx: "member", amount: cta.amount, plan: "premium" });
    else if (cta.act === "ticket") setTicketOpen(true);
  };

  return (
    <div className="detail open" ref={ref} role="dialog" aria-modal="true" aria-labelledby="d-title">
      <div className="d-media">
        {image && <img ref={imgRef} src={`/img/${image}`} alt={caption ?? ""} style={{ objectPosition: imagePosition ?? "50% 50%" }} />}
        <div className="veil" />
        {caption && <span className="cap">Photo : {caption}</span>}
      </div>
      <button className="d-back" ref={backRef} onClick={close}>
        <Icon name="chev-l" />
        Retour
      </button>
      <div className="d-scroll scroller">
        <div className="d-body">{children}</div>
        <div className="d-cta">
          <div className="d-cta-in">
            <div className="p">
              <b>{cta.p}</b>
              <span>{cta.s}</span>
            </div>
            {cta.act === "plans" ? (
              <Link className="btn btn-gold" href="/formules">
                {cta.label}
              </Link>
            ) : (
              <button className="btn btn-gold" onClick={onCta} disabled={cta.act === "none"} aria-disabled={cta.act === "none"}>
                {cta.act === "ticket" && <Icon name="ticket" />}
                {cta.act === "upgrade" && <Icon name="crown" />}
                {cta.label}
              </button>
            )}
          </div>
        </div>
      </div>
      <CheckoutSheet config={checkout} env={env} open={!!checkout} onClose={() => setCheckout(null)} />
      {cta.act === "ticket" && (
        <TicketSheet open={ticketOpen} onClose={() => setTicketOpen(false)} ticket={cta.ticket} demo={env.mode === "demo"} pending={cta.pending} cancelId={cta.cancelId} />
      )}
    </div>
  );
}
