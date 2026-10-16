"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PaidPlan } from "@/lib/types";
import { useCheckout } from "../events/CheckoutHost";
import type { PayEnv } from "../events/CheckoutSheet";
import { TicketSheet } from "../events/TicketSheet";
import { MemberCard } from "../ui/MemberCard";
import { Sheet } from "../ui/Sheet";
import type { TicketData } from "../ui/Ticket";
import { useToast } from "../ui/Toasts";

/** Bouton qui ouvre le tunnel « Renouveler » ou « Passer Premium ». */
export function MembershipButton({
  kind,
  plan,
  amount,
  env,
  className,
  children,
}: {
  kind: "renew" | "upgrade";
  plan: PaidPlan;
  amount: number;
  env: PayEnv;
  className: string;
  children: React.ReactNode;
}) {
  const openCheckout = useCheckout();
  return (
    <button className={className} onClick={() => openCheckout({ kind, ctx: "member", amount, plan }, env)}>
      {children}
    </button>
  );
}

/** Bouton « Mon billet ». */
export function TicketButton({
  ticket,
  demo,
  pending,
  cancelId,
  className,
  children,
}: {
  ticket: TicketData;
  demo: boolean;
  pending?: boolean;
  cancelId?: string | null;
  className: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <TicketSheet open={open} onClose={() => setOpen(false)} ticket={ticket} demo={demo} pending={pending} cancelId={cancelId} />
    </>
  );
}

/** Offre partenaire : feuille avec la carte de membre à montrer en caisse. */
export function OfferButton({
  offer,
  card,
}: {
  offer: { badge: string; partner: string; detail: string };
  card: { name: string; premium: boolean; validUntil: string; cardNumber: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="offer" onClick={() => setOpen(true)}>
        <span className="o-badge">{offer.badge}</span>
        <span>
          <b>{offer.partner}</b>
          <span>{offer.detail}</span>
        </span>
        <svg className="ic" aria-hidden="true">
          <use href="#i-chev-r" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={`Offre ${offer.partner}`}>
        <div className="done">
          <div className="eyebrow">Offre partenaire</div>
          <h2 className="sh-title">{offer.partner}</h2>
          <p className="sh-sub">{offer.detail}. Montre ta carte de membre en caisse.</p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <MemberCard {...card} />
          </div>
          <p className="fine">Offre réservée aux adhérentes.</p>
        </div>
      </Sheet>
    </>
  );
}

/** Tirer vers le bas pour rafraîchir (accueil membre, téléphone). */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const ptr = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sc = inner.current?.parentElement;
    const p = ptr.current;
    const el = inner.current;
    if (!sc || !p || !el) return;
    let y0: number | null = null;
    let dy = 0;
    let busy = false;
    const start = (e: TouchEvent) => {
      if (sc.scrollTop <= 0 && !busy) {
        y0 = e.touches[0].clientY;
        dy = 0;
      }
    };
    const move = (e: TouchEvent) => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (dy <= 0) {
        dy = 0;
        return;
      }
      const d = Math.min(110, dy * 0.45);
      el.style.transform = `translateY(${d}px)`;
      p.style.opacity = String(Math.min(1, d / 60));
      p.style.transform = `translateY(${d - 50}px) rotate(${d * 3}deg)`;
    };
    const reset = () => {
      el.style.transition = "transform .4s var(--out)";
      el.style.transform = "";
      p.style.transition = "all .4s var(--out)";
      p.style.opacity = "0";
      p.style.transform = "translateY(-50px)";
      setTimeout(() => {
        el.style.transition = "";
        p.style.transition = "";
      }, 420);
    };
    const end = () => {
      if (y0 == null) return;
      y0 = null;
      if (dy * 0.45 > 64) {
        busy = true;
        p.classList.add("spinning");
        p.style.transform = "translateY(14px)";
        el.style.transition = "transform .3s";
        el.style.transform = "translateY(60px)";
        router.refresh();
        setTimeout(() => {
          p.classList.remove("spinning");
          busy = false;
          reset();
          toast("Tout est à jour", "refresh");
        }, 1100);
      } else reset();
    };
    sc.addEventListener("touchstart", start, { passive: true });
    sc.addEventListener("touchmove", move, { passive: true });
    sc.addEventListener("touchend", end);
    return () => {
      sc.removeEventListener("touchstart", start);
      sc.removeEventListener("touchmove", move);
      sc.removeEventListener("touchend", end);
    };
  }, [router, toast]);
  return (
    <>
      <div className="ptr" ref={ptr} aria-hidden="true">
        <img src="/img/monogramme-clair.png" alt="" />
      </div>
      <div className="m-inner" ref={inner}>
        {children}
      </div>
    </>
  );
}

/** Champ « Une question ? » de l'accueil : ouvre l'assistant avec la question. */
export function AskHome() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const placeholder = "Une adresse pour un brunch à Guéliz ?";
  return (
    <form
      className="card ask-card"
      onSubmit={(e) => {
        e.preventDefault();
        const question = q.trim() || placeholder;
        try {
          sessionStorage.setItem("nc:ask", question);
          router.push("/espace/assistant");
        } catch {
          router.push(`/espace/assistant?q=${encodeURIComponent(question)}`);
        }
      }}
    >
      <h2 className="h-sm">Une question ?</h2>
      <p>L’assistant répond avec le carnet et l’agenda du club.</p>
      <div className="ask-field">
        <label className="sr" htmlFor="ask-home-input">
          Ta question
        </label>
        <input id="ask-home-input" autoComplete="off" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="send" aria-label="Envoyer">
          <svg className="ic" aria-hidden="true">
            <use href="#i-send" />
          </svg>
        </button>
      </div>
    </form>
  );
}
