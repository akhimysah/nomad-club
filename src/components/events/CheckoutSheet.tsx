"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { reserve, type ReserveResult } from "@/app/actions/booking";
import { startMembership, type MembershipResult } from "@/app/actions/membership";
import { money } from "@/lib/format";
import type { PaidPlan, PaymentMode } from "@/lib/types";
import { SpaceButton } from "../shell/SpaceButton";
import { EventImage } from "../ui/EventImage";
import { Icon } from "../ui/Icon";
import { MemberCard } from "../ui/MemberCard";
import { Seal } from "../ui/Seal";
import { Sheet } from "../ui/Sheet";
import { Ticket } from "../ui/Ticket";

export type CheckoutKind = "ticket" | "wait" | "join" | "renew" | "upgrade";

export type CheckoutEvent = {
  id: string;
  title: string;
  image: string | null;
  imagePosition: string | null;
  imageZoom: string | null;
  /** « lun. 26 oct. · 12 h – 15 h · Fer7 » */
  line: string;
  priceMember: number;
};

export type CheckoutConfig = {
  kind: CheckoutKind;
  ctx: "visit" | "member";
  amount: number;
  plan?: PaidPlan;
  event?: CheckoutEvent;
};

export type PayEnv = {
  mode: PaymentMode;
  transfer: { holder: string; iban: string };
  /** Personne connectée (prénom, nom, WhatsApp) : on saute l'étape « qui es-tu ». */
  me: { firstName: string; fullName: string; phone: string | null } | null;
};

type Stage = "who" | "pay" | "busy" | "done";

type Done = { kind: "reserve"; r: Extract<ReserveResult, { ok: true }> } | { kind: "membership"; r: Extract<MembershipResult, { ok: true }> };

const PLAN_NAME: Record<PaidPlan, string> = { member: "Membre", premium: "Premium" };
const wait = (ms: number) => new Promise((r) => setTimeout(r, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? Math.min(ms, 60) : ms));

function Steps({ n, total }: { n: number; total: number }) {
  return (
    <div className="ck-steps" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < n ? "on" : undefined} />
      ))}
    </div>
  );
}

function Summary({ c }: { c: CheckoutConfig }) {
  if (c.event)
    return (
      <div className="ck-sum">
        <span className="ph">
          <EventImage image={c.event.image} position={c.event.imagePosition} zoom={c.event.imageZoom} />
        </span>
        <div>
          <b>{c.event.title}</b>
          <span>{c.event.line}</span>
        </div>
      </div>
    );
  const plan = c.plan ?? "member";
  const t = c.kind === "renew" ? `Renouvellement ${PLAN_NAME[plan]}` : c.kind === "upgrade" ? "Passage à Premium" : `Adhésion ${PLAN_NAME[plan]}`;
  return (
    <div className="ck-sum">
      <span className="ph noimg" style={{ display: "grid", placeItems: "center" }}>
        <img src="/img/monogramme-clair.png" alt="" style={{ position: "static", height: 40, width: "auto" }} />
      </span>
      <div>
        <b>{t}</b>
        <span>Valable un an · prix en dollars US</span>
      </div>
    </div>
  );
}

/**
 * Tunnel de réservation et d'adhésion, dans une feuille (maquette) :
 * prénom + WhatsApp (sans compte) → paiement (simulé, Stripe ou virement) → sceau et billet / carte.
 */
export function CheckoutSheet({ config, env, open, onClose }: { config: CheckoutConfig | null; env: PayEnv; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("who");
  const [first, setFirst] = useState("");
  const [phone, setPhone] = useState("");
  const [parrain, setParrain] = useState(""); // --- Lot 4 --- code de parrainage
  const [errs, setErrs] = useState<{ firstName?: string; whatsapp?: string; general?: string }>({});
  const [paying, setPaying] = useState<"idle" | "busy" | "ok">("idle");
  const [done, setDone] = useState<Done | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const c = config;
  const visit = !env.me;
  const free = !c || c.kind === "wait" || c.amount === 0;
  const total = free ? (visit ? 2 : 1) : visit ? 3 : 2;

  const run = async (who: { firstName?: string; whatsapp?: string; referralCode?: string }): Promise<Done | null> => {
    if (!c) return null;
    setErrs({});
    if (c.kind === "ticket" || c.kind === "wait") {
      const r = await reserve({ eventId: c.event!.id, firstName: who.firstName, whatsapp: who.whatsapp, wait: c.kind === "wait", referralCode: who.referralCode });
      if (!r.ok) {
        setErrs(r.field ? { [r.field]: r.error } : { general: r.error });
        if (r.field) setStage("who");
        return null;
      }
      return { kind: "reserve", r };
    }
    const m = await startMembership({ action: c.kind, plan: c.plan ?? "member", firstName: who.firstName, whatsapp: who.whatsapp, referralCode: who.referralCode });
    if (!m.ok) {
      setErrs(m.field ? { [m.field]: m.error } : { general: m.error });
      if (m.field) setStage("who");
      return null;
    }
    return { kind: "membership", r: m };
  };

  const finish = async (who: { firstName?: string; whatsapp?: string; referralCode?: string }) => {
    const d = await run(who);
    if (d) {
      setDone(d);
      setStage("done");
    }
  };

  // Ouverture : on repart du début. Membre + gratuit / liste d'attente : confirmation directe.
  useEffect(() => {
    if (!open || !c) {
      started.current = false;
      return;
    }
    if (started.current) return;
    started.current = true;
    setDone(null);
    setErrs({});
    setPaying("idle");
    setParrain(/(?:^|; )nc_parrain=([^;]+)/.exec(document.cookie)?.[1] ?? ""); // --- Lot 4 ---
    if (visit) setStage("who");
    else if (free) {
      setStage("busy");
      void finish({});
    } else setStage("pay");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, c]);

  const submitWho = (e: React.FormEvent) => {
    e.preventDefault();
    const er: typeof errs = {};
    if (first.trim().length < 2) er.firstName = "Ton prénom, pour ton billet.";
    if (phone.replace(/\D/g, "").length < 8) er.whatsapp = "Un numéro WhatsApp complet, avec l’indicatif.";
    setErrs(er);
    if (er.firstName) return firstRef.current?.focus();
    if (er.whatsapp) return phoneRef.current?.focus();
    if (free) {
      setStage("busy");
      void finish({ firstName: first, whatsapp: phone, referralCode: parrain });
    } else setStage("pay");
  };

  const pay = async () => {
    if (!c || paying !== "idle") return;
    const who = visit ? { firstName: first, whatsapp: phone, referralCode: parrain } : {};
    if (env.mode === "stripe") {
      setPaying("busy");
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: c.kind, eventId: c.event?.id, plan: c.plan, ...who }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setPaying("idle");
      setErrs({ general: data.error ?? "Le paiement n’a pas pu démarrer. Réessaie dans un instant." });
      return;
    }
    setPaying("busy");
    const [d] = await Promise.all([run(who), wait(env.mode === "demo" ? 1500 : 500)]);
    if (!d) {
      setPaying("idle");
      return;
    }
    setPaying("ok");
    await wait(450);
    setDone(d);
    setStage("done");
  };

  const shownStage = stage;
  const showDone = stage === "done";
  const demo = env.mode === "demo";

  let body: React.ReactNode = null;
  if (c && shownStage === "who") {
    const title = c.kind === "wait" ? "Rejoindre la liste d’attente" : c.kind === "join" ? "Bienvenue, faisons connaissance" : "Ta place, en deux infos";
    const sub = c.kind === "join" ? "Prénom et WhatsApp suffisent pour créer ton adhésion." : "Prénom et WhatsApp suffisent. Ton compte gratuit se crée à ta première réservation.";
    body = (
      <>
        <Steps n={1} total={total} />
        <Summary c={c} />
        <h2 className="sh-title">{title}</h2>
        <p className="sh-sub">{sub}</p>
        {errs.general && (
          <div className="flash">
            <Icon name="bell" />
            {errs.general}
          </div>
        )}
        <form onSubmit={submitWho} noValidate>
          <div className={"field" + (errs.firstName ? " err" : "")}>
            <label htmlFor="bk-prenom">Prénom</label>
            <input id="bk-prenom" ref={firstRef} autoComplete="given-name" placeholder="Ton prénom" value={first} onChange={(e) => setFirst(e.target.value)} />
            <span className="err-msg">{errs.firstName}</span>
          </div>
          <div className={"field" + (errs.whatsapp ? " err" : "")}>
            <label htmlFor="bk-whatsapp">Numéro WhatsApp</label>
            <input id="bk-whatsapp" ref={phoneRef} type="tel" inputMode="tel" autoComplete="tel" placeholder="+212 6 12 34 56 78" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <span className="err-msg">{errs.whatsapp}</span>
          </div>
          {/* --- Lot 4 --- : parrainage */}
          <div className="field">
            <label htmlFor="bk-parrain">Code de parrainage (facultatif)</label>
            <input id="bk-parrain" autoComplete="off" autoCapitalize="characters" placeholder="INES-7K2Q" maxLength={20} value={parrain} onChange={(e) => setParrain(e.target.value)} />
          </div>
          <button className="btn btn-gold btn-block" type="submit">
            {c.kind === "wait" ? "M’inscrire sur la liste" : free ? "Confirmer ma place" : "Continuer vers le paiement"} <Icon name="arrow-r" />
          </button>
        </form>
        {c.kind === "ticket" && c.event && (
          <p style={{ textAlign: "center", margin: "10px 0 0" }}>
            <Link className="link" href="/formules" onClick={onClose}>
              Voir l’adhésion · tarif membre {c.event.priceMember}&nbsp;$
            </Link>
          </p>
        )}
        <p className="fine">
          <Icon name="lock" />
          Pas de mot de passe.{demo ? " Rien ne part vraiment, c’est un aperçu." : ""}
        </p>
      </>
    );
  } else if (c && shownStage === "pay") {
    const plan = c.plan ?? "member";
    const line =
      c.kind === "ticket"
        ? `Place · ${c.ctx === "member" ? "tarif adhérente" : "tarif public"}`
        : c.kind === "renew"
          ? `Formule ${PLAN_NAME[plan]} · 1 an`
          : c.kind === "upgrade"
            ? "Différence Membre vers Premium"
            : `Formule ${PLAN_NAME[plan]} · 1 an`;
    const n = visit ? 2 : 1;
    body = (
      <>
        <Steps n={n} total={total} />
        <Summary c={c} />
        <h2 className="sh-title">Paiement</h2>
        <p className="sh-sub">
          {env.mode === "demo"
            ? "Paiement en ligne sécurisé. Ici, il est simulé : aucun montant n’est débité."
            : env.mode === "stripe"
              ? "Paiement sécurisé par carte, sur la page Stripe."
              : "Règle par virement : ta demande est enregistrée, Julia et Nora la valident à réception."}
        </p>
        {errs.general && (
          <div className="flash">
            <Icon name="bell" />
            {errs.general}
          </div>
        )}
        <div className="pay-lines">
          <div>
            <span>{line}</span>
            <span>{money(c.amount)}</span>
          </div>
          <div>
            <span>Frais</span>
            <span>0&nbsp;$</span>
          </div>
          <div>
            <span>Total</span>
            <b>{money(c.amount)}</b>
          </div>
        </div>
        {env.mode === "transfer" ? (
          <div className="transfer">
            Bénéficiaire : <b>{env.transfer.holder}</b>
            <br />
            IBAN : <b>{env.transfer.iban}</b>
            <br />
            Indique ton prénom en référence.
          </div>
        ) : (
          <div className="paycard">
            <span className="cc" />
            <div>
              <b>{env.mode === "demo" ? "Carte de démonstration" : "Carte bancaire"}</b>
              <span>{env.mode === "demo" ? "•••• 4242 · simulée" : "Visa, Mastercard, Apple Pay"}</span>
            </div>
            <Icon name="check" />
          </div>
        )}
        <button className="btn btn-gold btn-block" onClick={pay} disabled={paying !== "idle"}>
          {paying === "busy" ? (
            <>
              <span className="spin" />
              {env.mode === "stripe" ? "Ouverture de Stripe…" : "Paiement en cours…"}
            </>
          ) : paying === "ok" ? (
            <>
              <Icon name="check" />
              Paiement accepté
            </>
          ) : (
            <>
              <Icon name="lock" />
              {env.mode === "transfer" ? `J’ai fait le virement de ${money(c.amount)}` : `Payer ${money(c.amount)}`}
            </>
          )}
        </button>
        <p className="fine">
          <Icon name="chat" />
          Ton reçu et ton billet partent sur WhatsApp.{demo ? " Simulé." : ""}
        </p>
      </>
    );
  } else if (shownStage === "busy") {
    body = (
      <div className="done" style={{ padding: "40px 0" }}>
        <span className="spin" style={{ display: "inline-block", width: 28, height: 28 }} />
        {errs.general && (
          <div className="flash" style={{ marginTop: 20 }}>
            <Icon name="bell" />
            {errs.general}
          </div>
        )}
      </div>
    );
  } else if (c && showDone && done) {
    if (done.kind === "reserve" && done.r.kind === "booked") {
      const r = done.r;
      body = (
        <div className="done">
          <Seal />
          <h2 className="sh-title">
            {r.already ? "Tu as déjà ta place" : "C’est réservé"}, {r.name}.
          </h2>
          <p className="sh-sub">
            {r.pending
              ? "Ta place est retenue. Elle sera confirmée dès que Julia et Nora auront reçu ton virement."
              : `Ton billet part sur WhatsApp${r.phone ? ` au ${r.phone}` : ""}.${demo ? " Simulé, rien ne part vraiment." : ""}`}
          </p>
          <Ticket t={r.ticket} />
          <p className="fine">
            <Icon name="swap" />
            Incline ton billet pour voir le reflet doré.
          </p>
          <button className="btn btn-gold btn-block" style={{ marginTop: 18 }} onClick={onClose}>
            C’est noté
          </button>
          {c.ctx === "visit" && (
            <p style={{ textAlign: "center", margin: "8px 0 0" }}>
              <Link className="link" href={`/billet/${r.ticket.code}`} onClick={onClose}>
                Ouvrir la page de mon billet <Icon name="arrow-r" />
              </Link>
            </p>
          )}
        </div>
      );
    } else if (done.kind === "reserve" && done.r.kind === "waitlist") {
      const r = done.r;
      body = (
        <div className="done">
          <Seal />
          <h2 className="sh-title">Tu es sur la liste, {r.name}.</h2>
          <p className="sh-sub">
            Tu es {r.position}
            <sup>{r.position === 1 ? "re" : "e"}</sup> sur la liste d’attente du {r.eventTitle.charAt(0).toLowerCase() + r.eventTitle.slice(1)}. Dès qu’une place se libère, on te prévient sur WhatsApp.
            {demo ? " Simulé." : ""}
          </p>
          <button className="btn btn-gold btn-block" onClick={onClose}>
            Parfait
          </button>
        </div>
      );
    } else if (done.kind === "membership") {
      const r = done.r;
      const premium = r.plan === "premium";
      if (c.kind === "join")
        body = (
          <div className="done">
            <Seal />
            <h2 className="sh-title">Bienvenue au club, {r.name}.</h2>
            <p className="sh-sub">{r.declared ? `Ton adhésion ${PLAN_NAME[r.plan]} sera active dès réception de ton virement.` : `Ton adhésion ${PLAN_NAME[r.plan]} est active. Voici ta carte de membre.`}</p>
            {!r.declared && (
              <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 6px" }}>
                <MemberCard name={r.fullName} premium={premium} validUntil={r.validUntil} cardNumber={r.cardNumber} />
              </div>
            )}
            <SpaceButton space="member" demo={demo} className="btn btn-gold btn-block" onDone={onClose}>
              Découvrir l’espace membre <Icon name="arrow-r" />
            </SpaceButton>
            {demo && <p className="fine">Adhésion simulée. L’espace membre montre celui d’Inès.</p>}
          </div>
        );
      else if (c.kind === "renew")
        body = (
          <div className="done">
            <Seal />
            <h2 className="sh-title">{r.declared ? "C’est noté." : "C’est renouvelé."}</h2>
            <p className="sh-sub">
              {r.declared
                ? "Ton renouvellement sera actif dès réception de ton virement. Merci de rester dans le cercle."
                : `Ta formule ${PLAN_NAME[r.plan]} court jusqu’au ${r.validUntilLong}. Merci de rester dans le cercle.`}
            </p>
            <button className="btn btn-gold btn-block" onClick={onClose}>
              Merci
            </button>
          </div>
        );
      else
        body = (
          <div className="done">
            <Seal />
            <h2 className="sh-title">{r.declared ? "C’est noté." : "Te voilà Premium."}</h2>
            <p className="sh-sub">
              {r.declared
                ? "Tu passeras Premium dès réception de ton virement."
                : "Les rendez-vous Premium te sont offerts, et tu peux venir avec une invitée chaque trimestre. Ta carte a changé de couleur."}
            </p>
            {!r.declared && (
              <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 6px" }}>
                <MemberCard name={r.fullName} premium validUntil={r.validUntil} cardNumber={r.cardNumber} />
              </div>
            )}
            <button className="btn btn-gold btn-block" style={{ marginTop: 18 }} onClick={onClose}>
              Voir mon espace
            </button>
          </div>
        );
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose();
        if (done) router.refresh();
      }}
      label={c?.kind === "join" ? "Adhésion" : "Réservation"}
    >
      <div key={shownStage} className="stage-in">
        {body}
      </div>
    </Sheet>
  );
}
