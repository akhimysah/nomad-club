"use client";

import { useRef, useState, useTransition } from "react";
import { saveBasicProfileAction } from "@/app/actions/lancement";
import { useToast } from "../ui/Toasts";
import { Icon } from "../ui/Icon";

type Form = { firstName: string; lastName: string; job: string; country: string; whatsapp: string; avatarUrl: string | null };

/** Réduit une photo à 480 px (JPEG) pour rester sous la limite d'1 Mo. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 480 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Onboarding d'un compte gratuit : fiche de base et photo (les membres ont la fiche d'annuaire complète). */
export function BasicProfileForm({ initial, onSaved }: { initial: Form; onSaved?: string }) {
  const [f, setF] = useState<Form>(initial);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const initials = (f.firstName[0] ?? "") + (f.lastName[0] ?? "");
  return (
    <form
      id="lc-basic-profile"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveBasicProfileAction(f);
          toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
          if (r.ok && onSaved) (document.getElementById(onSaved) as HTMLButtonElement | null)?.click();
        });
      }}
    >
      <div className="lc-photo">
        {f.avatarUrl ? (
          // photo choisie par la personne (data: URL locale) : pas d'optimisation next/image possible
          <img src={f.avatarUrl} alt="Ta photo" width={72} height={72} />
        ) : (
          <span className="lc-initials" aria-hidden="true">
            {initials.toUpperCase() || "?"}
          </span>
        )}
        <div className="btn-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            {f.avatarUrl ? "Changer la photo" : "Ajouter une photo"}
          </button>
          {f.avatarUrl && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("avatarUrl", null)}>
              Retirer
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            aria-label="Choisir une photo"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast("Choisis une photo JPEG ou PNG.", "bell");
              set("avatarUrl", await shrink(file));
            }}
          />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="bp-first">Prénom</label>
          <input id="bp-first" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} required autoComplete="given-name" />
        </div>
        <div className="field">
          <label htmlFor="bp-last">Nom</label>
          <input id="bp-last" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="bp-job">Métier</label>
          <input id="bp-job" value={f.job} onChange={(e) => set("job", e.target.value)} autoComplete="organization-title" />
        </div>
        <div className="field">
          <label htmlFor="bp-country">Pays ou nationalité</label>
          <input id="bp-country" value={f.country} onChange={(e) => set("country", e.target.value)} autoComplete="country-name" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="bp-wa">WhatsApp</label>
        <input id="bp-wa" type="tel" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} autoComplete="tel" />
      </div>
      <button className="btn btn-gold" type="submit" disabled={pending}>
        {pending ? <span className="spin" /> : <Icon name="check" />}
        Enregistrer et continuer
      </button>
    </form>
  );
}
