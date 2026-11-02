"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import "@/styles/partenaires.css";
import {
  changePlanAction,
  inviteMemberAction,
  paySubscriptionAction,
  saveEstablishmentAction,
  saveOfferAction,
  setCancelAction,
  setOfferStatusAction,
  validateCodeAction,
  type FormState,
  type ValidateState,
} from "@/app/actions/partenaires";
import { CATEGORY_KEYS, CATEGORY_LABEL, PRO_PLANS, PRO_PLAN_KEYS } from "@/lib/modules/partenaires/domain";
import type { Establishment, Offer, ProPlan } from "@/lib/modules/partenaires/types";
import { Icon } from "../ui/Icon";
import { useContractGate } from "../contrats/ContractGate"; // --- Vague 2 · Contrats ---
import { useToast } from "../ui/Toasts";

function Msg({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <div className={"form-msg" + (state.ok ? "" : " err")} role="status">
      <Icon name={state.ok ? "check" : "bell"} />
      {state.message}
    </div>
  );
}

function Field({ label, name, state, hint, children }: { label: string; name: string; state: FormState; hint?: string; children: React.ReactNode }) {
  const err = state?.errors?.[name];
  return (
    <div className={"field" + (err ? " err" : "")}>
      <label htmlFor={`f-${name}`}>{label}</label>
      {children}
      {err ? <span className="err">{err}</span> : hint ? <small>{hint}</small> : null}
    </div>
  );
}

/* ---------- fiche établissement ---------- */

export function EstablishmentForm({ e, areas, pro }: { e: Establishment; areas: string[]; pro: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEstablishmentAction.bind(null, e.id), null);
  const d = e.details;
  return (
    <form action={action} className="card p-form">
      <div className="card-h">
        <h2>Modifier la fiche</h2>
        <span className="muted">Visible par les membres{pro ? " si ton abonnement est actif" : ""}</span>
      </div>
      <Msg state={state} />
      <fieldset>
        <legend>Présentation</legend>
        <Field label="Description" name="description" state={state} hint="Deux ou trois phrases : ce que tu proposes, pour qui.">
          <textarea id="f-description" name="description" defaultValue={e.description ?? ""} maxLength={800} />
        </Field>
        <div className="f2">
          <Field label="Catégorie du carnet" name="carnetCategory" state={state}>
            <select id="f-carnetCategory" name="carnetCategory" defaultValue={d.carnetCategory ?? ""}>
              <option value="">Aucune</option>
              {CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {CATEGORY_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Horaires" name="hours" state={state}>
            <input id="f-hours" name="hours" defaultValue={d.hours ?? ""} placeholder="Du mardi au samedi, 9 h – 19 h" maxLength={400} />
          </Field>
        </div>
        {pro && (
          <Field label="Réduction pour les membres (facultatif)" name="memberDiscount" state={state} hint="Mise en avant dans le carnet : « -10 % sur la première séance ».">
            <input id="f-memberDiscount" name="memberDiscount" defaultValue={d.memberDiscount ?? ""} maxLength={160} />
          </Field>
        )}
        <Field label="Photos (une par ligne)" name="photos" state={state} hint="Adresse https://… ou nom d’une image du club. 8 au plus ; la première sert de couverture.">
          <textarea id="f-photos" name="photos" defaultValue={d.photos.join("\n")} />
        </Field>
      </fieldset>
      <fieldset>
        <legend>Adresse et carte</legend>
        <Field label="Adresse" name="address" state={state}>
          <input id="f-address" name="address" defaultValue={e.address ?? ""} maxLength={200} />
        </Field>
        <div className="f3">
          <Field label="Quartier" name="area" state={state}>
            <select id="f-area" name="area" defaultValue={e.area ?? ""}>
              <option value="">À préciser</option>
              {[...new Set([...(e.area ? [e.area] : []), ...areas])].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Latitude" name="lat" state={state} hint="Vide : centre du quartier.">
            <input id="f-lat" name="lat" inputMode="decimal" defaultValue={e.lat ?? ""} placeholder="31.6347" />
          </Field>
          <Field label="Longitude" name="lng" state={state}>
            <input id="f-lng" name="lng" inputMode="decimal" defaultValue={e.lng ?? ""} placeholder="-8.0102" />
          </Field>
        </div>
      </fieldset>
      <fieldset>
        <legend>Contacts</legend>
        <div className="f2">
          <Field label="Téléphone" name="phone" state={state}>
            <input id="f-phone" name="phone" type="tel" defaultValue={e.phone ?? ""} />
          </Field>
          <Field label="WhatsApp" name="whatsapp" state={state}>
            <input id="f-whatsapp" name="whatsapp" type="tel" defaultValue={d.whatsapp ?? ""} />
          </Field>
          <Field label="E-mail" name="email" state={state}>
            <input id="f-email" name="email" type="email" defaultValue={e.email ?? ""} />
          </Field>
          <Field label="Site" name="website" state={state}>
            <input id="f-website" name="website" type="url" defaultValue={e.website ?? ""} placeholder="https://" />
          </Field>
          <Field label="Instagram" name="instagram" state={state}>
            <input id="f-instagram" name="instagram" defaultValue={e.instagram ?? ""} placeholder="@" />
          </Field>
        </div>
      </fieldset>
      <button className="btn btn-ink btn-sm" type="submit" disabled={pending}>
        <Icon name="check" />
        {pending ? "Enregistrement…" : "Enregistrer la fiche"}
      </button>
    </form>
  );
}

/* ---------- offres ---------- */

export function OfferForm({ organizationId, offer }: { organizationId: string; offer: Offer | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveOfferAction.bind(null, organizationId, offer?.id ?? null), null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok && !offer) router.push("/partenaire/offres?org=" + organizationId);
  }, [state, offer, router, organizationId]);
  return (
    <form action={action} className="card p-form">
      <div className="card-h">
        <h2>{offer ? "Modifier l’offre" : "Nouvelle offre"}</h2>
      </div>
      <Msg state={state} />
      <div className="f2">
        <Field label="Titre" name="title" state={state}>
          <input id="f-title" name="title" defaultValue={offer?.title ?? ""} placeholder="Un café offert" required maxLength={80} />
        </Field>
        <Field label="Réduction ou avantage (court)" name="badge" state={state} hint="Affiché en gros : « -15 % », « Offert », « 1 h ».">
          <input id="f-badge" name="badge" defaultValue={offer?.badge ?? ""} placeholder="-15 %" required maxLength={10} />
        </Field>
      </div>
      <Field label="En une phrase" name="detail" state={state}>
        <input id="f-detail" name="detail" defaultValue={offer?.detail ?? ""} placeholder="Avec ta viennoiserie, du lundi au vendredi" required maxLength={160} />
      </Field>
      <Field label="Conditions" name="conditions" state={state}>
        <textarea id="f-conditions" name="conditions" defaultValue={offer?.conditions ?? ""} placeholder="Sur place uniquement. Une fois par visite." maxLength={400} />
      </Field>
      <div className="f3">
        <Field label="Réservée à" name="audience" state={state}>
          <select id="f-audience" name="audience" defaultValue={offer?.audience ?? "all"}>
            <option value="all">Toutes les membres</option>
            <option value="member">Formule Membre et Premium</option>
            <option value="premium">Premium seulement</option>
          </select>
        </Field>
        <Field label="Valable à partir du" name="validFrom" state={state}>
          <input id="f-validFrom" name="validFrom" type="date" defaultValue={offer?.validFrom ?? ""} />
        </Field>
        <Field label="Jusqu’au" name="validUntil" state={state} hint="Vide : sans limite.">
          <input id="f-validUntil" name="validUntil" type="date" defaultValue={offer?.validUntil ?? ""} />
        </Field>
      </div>
      <button className="btn btn-ink btn-sm" type="submit" disabled={pending}>
        <Icon name="check" />
        {pending ? "Enregistrement…" : offer ? "Enregistrer" : "Mettre en ligne"}
      </button>
    </form>
  );
}

export function OfferStatusButton({ offerId, paused }: { offerId: string; paused: boolean }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await setOfferStatusAction(offerId, !paused);
        setBusy(false);
        toast(r.message, r.ok ? "check" : "bell");
        router.refresh();
      }}
    >
      <Icon name={paused ? "refresh" : "clock"} />
      {paused ? "Remettre en ligne" : "Mettre en pause"}
    </button>
  );
}

/* ---------- équipe ---------- */

export function InviteForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(inviteMemberAction.bind(null, organizationId), null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form action={action} ref={ref} className="p-form" style={{ marginTop: 14 }}>
      <Msg state={state} />
      <Field label="Inviter une collaboratrice (e-mail)" name="email" state={state} hint="Elle pourra modifier la fiche, gérer les offres et valider les codes.">
        <input id="f-email-invite" name="email" type="email" required placeholder="prenom@exemple.com" />
      </Field>
      <button className="btn btn-ghost btn-sm" type="submit" disabled={pending}>
        <Icon name="send" />
        {pending ? "Envoi…" : "Inviter"}
      </button>
    </form>
  );
}

/* ---------- validation d'un code au comptoir ---------- */

type Detector = { detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/** Saisie du code, ou scan du QR avec la caméra (navigateurs compatibles ; sinon l'appareil photo du téléphone ouvre ce lien). */
export function ValidateCodeForm({ initialCode }: { initialCode: string }) {
  const [state, action, pending] = useActionState<ValidateState, FormData>(validateCodeAction, null);
  const [code, setCode] = useState(initialCode);
  const [scanning, setScanning] = useState(false);
  const [canScan, setCanScan] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    setCanScan(typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia);
  }, []);
  useEffect(() => {
    if (state?.ok) setCode("");
  }, [state]);
  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let stop = false;
    const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
    const detector = new Ctor({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        while (!stop) {
          const found = await detector.detect(v).catch(() => []);
          const raw = found[0]?.rawValue;
          if (raw) {
            const m = raw.match(/code=([^&]+)/);
            setCode(decodeURIComponent(m ? m[1] : raw));
            setScanning(false);
            setTimeout(() => formRef.current?.requestSubmit(), 50);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setScanning(false);
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);
  return (
    <form action={action} ref={formRef} className="card p-form">
      <div className="card-h">
        <h2>Valider un code</h2>
        <span className="muted">La membre te montre son code ou son QR</span>
      </div>
      <div className="validate-box">
        <label className="sr" htmlFor="f-code">
          Code de l’offre
        </label>
        <input id="f-code" name="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="OF-7KQD-M3XP" autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
        <button className="btn btn-ink" type="submit" disabled={pending}>
          <Icon name="check" />
          {pending ? "Vérification…" : "Valider"}
        </button>
        {canScan && (
          <button className="btn btn-ghost" type="button" onClick={() => setScanning((s) => !s)}>
            <Icon name="search" />
            {scanning ? "Arrêter" : "Scanner"}
          </button>
        )}
      </div>
      {scanning && <video ref={videoRef} className="scan-video" muted playsInline />}
      {state && !state.ok && (
        <div className="form-msg err" role="alert" style={{ marginTop: 14 }}>
          <Icon name="bell" />
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="validated" role="status">
          <span className="vk">
            <Icon name="check" />
          </span>
          <span>
            <b>
              Code validé · {state.validated.badge} {state.validated.offerTitle}
            </b>
            <span>
              {state.validated.firstName}
              {state.validated.premium ? " · Premium" : ""} · code {state.validated.code}, créé le{" "}
              {new Date(state.validated.createdAt).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </span>
        </div>
      )}
      <p className="muted" style={{ fontSize: 14, margin: "14px 0 0" }}>
        Astuce : le QR de la membre ouvre directement cette page avec le code rempli, depuis l’appareil photo de ton téléphone.
      </p>
    </form>
  );
}

/* ---------- abonnement pro ---------- */

export function SubscriptionActions({ organizationId, current, cancelAtPeriodEnd, needsPayment, hasSubscription }: { organizationId: string; current: ProPlan | null; cancelAtPeriodEnd: boolean; needsPayment: boolean; hasSubscription: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const run = async (key: string, fn: () => Promise<{ ok: boolean; message: string }>) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    toast(r.message, r.ok ? "check" : "bell");
    router.refresh();
  };
  // --- Vague 2 · Contrats --- : le contrat de la formule est accepté avant le paiement (déjà accepté : on passe)
  const { gate, sheet } = useContractGate();
  const withContract = (plan: ProPlan, fn: () => Promise<{ ok: boolean; message: string }>) => async () =>
    (await gate({ kind: "pro", plan, organizationId })) ? fn() : { ok: false, message: "Le contrat doit être accepté avant le paiement." };
  return (
    <>
      {sheet}
      <div className="btn-row" style={{ marginTop: 16 }}>
        {current && (
          <button className="btn btn-ink btn-sm" type="button" disabled={!!busy} onClick={() => run("pay", withContract(current, () => paySubscriptionAction(organizationId, current)))}>
            <Icon name="card" />
            {busy === "pay" ? "Paiement…" : needsPayment ? `Régler l’échéance · ${PRO_PLANS[current].price} $` : `Payer le mois suivant · ${PRO_PLANS[current].price} $`}
          </button>
        )}
        {current && (
          <button className="btn btn-ghost btn-sm" type="button" disabled={!!busy} onClick={() => run("fail", () => paySubscriptionAction(organizationId, current, true))}>
            Simuler un refus de carte
          </button>
        )}
        {hasSubscription && (
          <button className="btn btn-ghost btn-sm" type="button" disabled={!!busy} onClick={() => run("cancel", () => setCancelAction(organizationId, !cancelAtPeriodEnd))}>
            {cancelAtPeriodEnd ? "Reprendre l’abonnement" : "Arrêter à l’échéance"}
          </button>
        )}
      </div>
      <div className="plan-grid">
        {PRO_PLAN_KEYS.map((k) => {
          const p = PRO_PLANS[k];
          const on = current === k;
          return (
            <div key={k} className={"plan" + (on ? " on" : "")}>
              <h3>{p.label}</h3>
              <div className="price">
                {p.price} $ <small>/ mois</small>
              </div>
              <ul>
                {p.perks.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              {on ? (
                <span className="chip solid">Ta formule</span>
              ) : (
                <button className="btn btn-ghost btn-sm" type="button" disabled={!!busy} onClick={() => run("plan-" + k, withContract(k, () => changePlanAction(organizationId, k)))}>
                  {busy === "plan-" + k ? "Un instant…" : hasSubscription ? "Choisir" : `S’abonner · ${p.price} $`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
