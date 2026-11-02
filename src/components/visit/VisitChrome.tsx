"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SpaceButton } from "../shell/SpaceButton";
import { Icon } from "../ui/Icon";
import { TabIndicator } from "../ui/TabIndicator";
import { useToast } from "../ui/Toasts";

const SECTIONS: Record<string, string> = { "/rendez-vous": "v-agenda", "/club": "v-club", "/formules": "v-formules" };

function scrollerEl(): HTMLElement | null {
  return document.getElementById("v-scroll");
}

/** Sur ordinateur, l'accueil est une longue page : les liens du menu y défilent jusqu'à la section. */
function useSectionNav() {
  const pathname = usePathname();
  return (e: React.MouseEvent, href: string) => {
    if (pathname !== "/" || window.matchMedia("(max-width: 760px)").matches) return;
    const sc = scrollerEl();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!sc) return;
    if (href === "/") {
      e.preventDefault();
      sc.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      return;
    }
    const el = document.getElementById(SECTIONS[href] ?? "");
    if (!el) return;
    e.preventDefault();
    sc.scrollTo({ top: el.offsetTop - 60, behavior: reduced ? "auto" : "smooth" });
  };
}

/** Zone qui défile de l'espace Compte gratuit : barre du haut qui se solidifie, apparitions au défilement. */
export function VisitScroller({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sc = ref.current;
    if (!sc) return;
    sc.scrollTop = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = Array.from(sc.querySelectorAll<HTMLElement>(".rv:not(.in), .quote:not(.in)"));
    if (reduced || !("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((x) => {
          if (x.isIntersecting) {
            x.target.classList.add("in");
            io.unobserve(x.target);
          }
        }),
      { threshold: 0.12 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [pathname]);

  return (
    <div className="v-scroll scroller" id="v-scroll" ref={ref}>
      {children}
    </div>
  );
}

export function VNav({ demo }: { demo: boolean }) {
  const go = useSectionNav();
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const sc = scrollerEl();
    if (!sc) return;
    const on = () => setSolid(sc.scrollTop > 12);
    on();
    sc.addEventListener("scroll", on, { passive: true });
    return () => sc.removeEventListener("scroll", on);
  }, []);
  return (
    <nav className={"v-nav" + (solid ? " solid" : "")} aria-label="Navigation du site">
      <Link className="v-logo" href="/" aria-label="Nomad Club, accueil" onClick={(e) => go(e, "/")}>
        <img src="/img/logotype-clair.png" alt="Marrakech Nomad Club" width={279} height={120} />
      </Link>
      <div className="v-links desk-only">
        <Link href="/rendez-vous" onClick={(e) => go(e, "/rendez-vous")}>
          Agenda
        </Link>
        <Link href="/club" onClick={(e) => go(e, "/club")}>
          Le club
        </Link>
        <Link href="/formules" onClick={(e) => go(e, "/formules")}>
          Formules
        </Link>
      </div>
      <div className="v-actions">
        <SpaceButton space="member" demo={demo} className="btn btn-ghost btn-sm desk-only">
          Espace adhérentes
        </SpaceButton>
        <Link className="btn btn-gold btn-sm" href="/formules" onClick={(e) => go(e, "/formules")}>
          Adhérer
        </Link>
      </div>
    </nav>
  );
}

const TABS = [
  { href: "/", icon: "home", label: "Accueil" },
  { href: "/rendez-vous", icon: "cal", label: "Agenda" },
  { href: "/club", icon: "heart", label: "Le club" },
  { href: "/formules", icon: "star", label: "Formules" },
] as const;

export function VTabbar({ demo }: { demo: boolean }) {
  const pathname = usePathname();
  const active = pathname === "/" ? "/" : TABS.find((t) => t.href !== "/" && pathname.startsWith(t.href))?.href;
  return (
    <nav className="tabbar" aria-label="Navigation de l’appli">
      <TabIndicator />
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={"tab" + (active === t.href ? " on" : "")} aria-current={active === t.href ? "page" : undefined}>
          <Icon name={t.icon} />
          <span className="lbl">{t.label}</span>
        </Link>
      ))}
      <SpaceButton space="member" demo={demo} className="tab">
        <Icon name="user" />
        <span className="lbl">Adhérentes</span>
      </SpaceButton>
    </nav>
  );
}

/** Bouton « Créer mon compte » : le compte se crée à la première réservation. */
export function FreeAccountButton({ toastText, href = null }: { toastText: string; href?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  // --- Lancement --- mode réel : vraie page d'inscription
  if (href)
    return (
      <Link className="btn btn-ghost btn-block" href={href}>
        Créer mon compte
      </Link>
    );
  return (
    <button
      className="btn btn-ghost btn-block"
      onClick={() => {
        toast(toastText, "user");
        router.push("/rendez-vous");
      }}
    >
      Créer mon compte
    </button>
  );
}
