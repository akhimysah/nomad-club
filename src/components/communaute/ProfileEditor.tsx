"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveProfileAction } from "@/app/actions/communaute";
import { SECTORS, VISIBILITY_LABEL } from "@/lib/modules/communaute/domain";
import type { DirectoryVisibility } from "@/lib/modules/communaute/types";
import type { ProfileForm } from "@/lib/modules/communaute/validation";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";
import { Photo } from "./Photo";

/** Réduit une photo à 480 px (JPEG) pour rester sous la limite d'1 Mo. */
async function shrink(file: File, max = 480): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Form = Omit<ProfileForm, "skills"> & { skills: string };

/** Lot 1 — Ma fiche : profil, informations d'annuaire et confidentialité. */
export function ProfileEditor({ initial, email }: { initial: Form; email: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const text = (k: keyof Form) => ({
    id: `pf-${k}`,
    value: (f[k] as string | null | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never),
  });

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast("Choisis une photo JPEG ou PNG.", "bell");
    set("avatarUrl", await shrink(file));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await saveProfileAction(f);
    setBusy(false);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) router.refresh();
  };

  const name = [f.firstName, f.lastName].filter(Boolean).join(" ") || "Moi";
  return (
    <form className="cm-form" onSubmit={submit}>
      <div className="moi-grid">
        <section className="card">
          <div className="card-h">
            <h2>Mon profil</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "12px 0 18px" }}>
            <Photo name={name} src={f.avatarUrl ?? null} size="lg" />
            <div className="btn-row">
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => fileRef.current?.click()}>
                <Icon name="user" />
                {f.avatarUrl ? "Changer la photo" : "Ajouter une photo"}
              </button>
              {f.avatarUrl && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => set("avatarUrl", null)}>
                  Retirer
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPhoto} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="pf-firstName">Prénom</label>
              <input {...text("firstName")} required maxLength={40} autoComplete="given-name" />
            </div>
            <div className="field">
              <label htmlFor="pf-lastName">Nom</label>
              <input {...text("lastName")} maxLength={60} autoComplete="family-name" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pf-job">Métier</label>
            <input {...text("job")} maxLength={120} placeholder="Ex. Architecte d’intérieur" />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="pf-company">Entreprise</label>
              <input {...text("company")} maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="pf-sector">Secteur</label>
              <select {...text("sector")}>
                <option value="">Choisir…</option>
                {SECTORS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="pf-country">Nationalité</label>
              <input {...text("country")} maxLength={80} placeholder="Ex. Française" />
            </div>
            <div className="field">
              <label htmlFor="pf-marrakechSince">À Marrakech depuis</label>
              <input {...text("marrakechSince")} maxLength={30} placeholder="Ex. 2021" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pf-bio">En quelques mots</label>
            <textarea {...text("bio")} className="sm" maxLength={600} />
          </div>
          <div className="field">
            <label htmlFor="pf-skills">Compétences (séparées par des virgules)</label>
            <input {...text("skills")} placeholder="Ex. Relations presse, Stratégie de marque" />
          </div>
          <div className="field">
            <label htmlFor="pf-lookingFor">Ce que je cherche</label>
            <textarea {...text("lookingFor")} className="sm" maxLength={500} />
          </div>
          <div className="field">
            <label htmlFor="pf-offering">Ce que je propose aux membres</label>
            <textarea {...text("offering")} className="sm" maxLength={500} />
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section className="card">
            <div className="card-h">
              <h2>Contact et réseaux</h2>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="pf-whatsapp">WhatsApp</label>
              <input {...text("whatsapp")} inputMode="tel" maxLength={30} placeholder="+212 6 …" />
            </div>
            <div className="field">
              <label htmlFor="pf-instagram">Instagram</label>
              <input {...text("instagram")} maxLength={200} placeholder="@moncompte" />
            </div>
            <div className="field">
              <label htmlFor="pf-linkedin">LinkedIn</label>
              <input {...text("linkedin")} maxLength={200} placeholder="linkedin.com/in/…" />
            </div>
            <div className="field">
              <label htmlFor="pf-website">Site</label>
              <input {...text("website")} maxLength={200} placeholder="https://…" />
            </div>
          </section>

          <section className="card">
            <div className="card-h">
              <h2>Confidentialité</h2>
            </div>
            <p className="muted" style={{ fontSize: 14.5, margin: "6px 0 14px" }}>
              Ce que les autres membres voient dans l’annuaire.
            </p>
            <div className="cm-choice" style={{ gridTemplateColumns: "1fr" }} role="radiogroup" aria-label="Visibilité de ma fiche">
              {(Object.keys(VISIBILITY_LABEL) as DirectoryVisibility[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={f.visibility === k} className={f.visibility === k ? "on" : undefined} onClick={() => set("visibility", k)}>
                  <b>{VISIBILITY_LABEL[k].label}</b>
                  <span>{VISIBILITY_LABEL[k].hint}</span>
                </button>
              ))}
            </div>
            <label className="toggle">
              Montrer mon WhatsApp
              <input type="checkbox" checked={!!f.showWhatsapp} disabled={f.visibility !== "all"} onChange={(e) => set("showWhatsapp", e.target.checked)} />
            </label>
            <label className="toggle">
              <span>
                Montrer mon e-mail
                {email && <span className="muted" style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{email}</span>}
              </span>
              <input type="checkbox" checked={!!f.showEmail} disabled={f.visibility !== "all"} onChange={(e) => set("showEmail", e.target.checked)} />
            </label>
          </section>

          <button className="btn btn-gold btn-block" disabled={busy}>
            {busy ? <span className="spin" /> : <Icon name="check" />}
            Enregistrer ma fiche
          </button>
        </div>
      </div>
    </form>
  );
}
