"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { importContactsAction, type ImportRow } from "@/app/actions/crm";
import { parseCsv } from "@/lib/modules/crm/csv";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

type Field = keyof ImportRow;

const FIELDS: Array<{ key: Field; label: string; guess: RegExp }> = [
  { key: "firstName", label: "Prénom", guess: /^(pr[eé]nom|first ?name|given)/i },
  { key: "lastName", label: "Nom", guess: /^(nom( de famille)?|last ?name|surname|family)$/i },
  { key: "company", label: "Société", guess: /soci[eé]t[eé]|entreprise|company|organi[sz]ation|[eé]tablissement/i },
  { key: "job", label: "Métier", guess: /m[eé]tier|fonction|poste|job|title/i },
  { key: "email", label: "E-mail", guess: /mail|courriel/i },
  { key: "phone", label: "Téléphone", guess: /t[eé]l|phone|portable|mobile|whatsapp/i },
  { key: "instagram", label: "Instagram", guess: /insta/i },
  { key: "city", label: "Ville", guess: /ville|city/i },
  { key: "source", label: "Source", guess: /source|origine|provenance/i },
  { key: "status", label: "Statut", guess: /statut|status/i },
  { key: "tags", label: "Étiquettes", guess: /[eé]tiquette|tag/i },
  { key: "consent", label: "Consentement", guess: /consent|newsletter|opt/i },
  { key: "notes", label: "Notes", guess: /note|commentaire|remarque/i },
];

const SAMPLE = `Prénom;Nom;E-mail;Téléphone;Source;Étiquettes;Consentement
Amal;Berrada;amal.berrada@exemple.com;+212 6 12 34 56 78;Instagram;entrepreneure;oui
Lucie;Martin;lucie.martin@exemple.com;;Soirée de lancement;;non`;

/** Import CSV : fichier ou texte collé → correspondance des colonnes → aperçu (nouveau, doublon, invalide) → import. */
export function ImportWizard({ emails, phones, owners, me }: { emails: string[]; phones: string[]; owners: Array<{ id: string; first: string }>; me: string }) {
  const toast = useToast();
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [map, setMap] = useState<Record<number, Field | "">>({});
  const [tag, setTag] = useState("import-" + new Date().toISOString().slice(0, 7));
  const [owner, setOwner] = useState(me);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const table = useMemo(() => (text.trim() ? parseCsv(text) : []), [text]);
  const header = table[0] ?? [];
  const body = table.slice(1);

  const load = (t: string, name: string | null) => {
    setText(t);
    setFileName(name);
    const h = parseCsv(t)[0] ?? [];
    const used = new Set<Field>();
    const m: Record<number, Field | ""> = {};
    h.forEach((col, i) => {
      const f = FIELDS.find((x) => !used.has(x.key) && x.guess.test(col.trim()));
      m[i] = f?.key ?? "";
      if (f) used.add(f.key);
    });
    setMap(m);
  };
  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) return toast("Fichier trop lourd (2 Mo au plus).", "bell");
    load(await f.text(), f.name);
  };

  const mapped: ImportRow[] = body.map((r) => {
    const o: ImportRow = {};
    header.forEach((_, i) => {
      const f = map[i];
      if (f && r[i]) o[f] = o[f] ? `${o[f]} ${r[i]}` : r[i];
    });
    return o;
  });
  const emailSet = useMemo(() => new Set(emails), [emails]);
  const phoneSet = useMemo(() => new Set(phones), [phones]);
  const statusOf = (o: ImportRow): "ok" | "dup" | "bad" => {
    if (!o.firstName && !o.lastName && !o.company) return "bad";
    if (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) return "bad";
    const e = o.email?.trim().toLowerCase();
    const p = (o.phone ?? "").replace(/\D/g, "").slice(-9);
    if ((e && emailSet.has(e)) || (p.length >= 8 && phoneSet.has(p))) return "dup";
    return "ok";
  };
  const statuses = mapped.map(statusOf);
  const nOk = statuses.filter((s) => s === "ok").length;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await importContactsAction(mapped, { tag, ownerId: owner || null });
      if (r.ok) {
        toast(r.message, "check");
        router.push(`/fondatrices/crm/contacts?tag=${encodeURIComponent(tag)}`);
      } else toast(r.error, "bell");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ccol">
      <section className="card">
        <div className="card-h">
          <h2>1. Le fichier</h2>
          <span className="muted">CSV (séparateur « , » ou « ; »), première ligne = en-têtes</span>
        </div>
        <label
          className={"dropzone" + (over ? " over" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            readFile(e.dataTransfer.files[0]);
          }}
          style={{ display: "block", cursor: "pointer" }}
        >
          <Icon name="inbox" />
          <p style={{ margin: "8px 0 4px", fontWeight: 600 }}>{fileName ?? "Déposez un fichier CSV ici, ou cliquez pour le choisir"}</p>
          <span className="muted" style={{ fontSize: 13.5 }}>
            Export Excel / Google Sheets en « CSV ». Rien n’est importé avant votre validation.
          </span>
          <input type="file" accept=".csv,text/csv,text/plain" className="sr" onChange={(e) => readFile(e.target.files?.[0])} />
        </label>
        <details className="cmore" style={{ marginTop: 12 }}>
          <summary>
            Ou coller le contenu <Icon name="chev-d" />
          </summary>
          <textarea value={text} onChange={(e) => load(e.target.value, null)} rows={6} placeholder={SAMPLE} style={{ marginTop: 8, fontFamily: "ui-monospace,monospace", fontSize: 13 }} />
          <button type="button" className="link" onClick={() => load(SAMPLE, "exemple.csv")}>
            Essayer avec un exemple
          </button>
        </details>
      </section>

      {header.length > 0 && (
        <section className="card">
          <div className="card-h">
            <h2>2. Correspondance des colonnes</h2>
            <span className="muted">
              {body.length} ligne{body.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mapgrid">
            {header.map((col, i) => (
              <label key={i} className="cf">
                <span>{col || `Colonne ${i + 1}`}</span>
                <small>ex. {body.find((r) => r[i])?.[i] ?? "—"}</small>
                <select value={map[i] ?? ""} onChange={(e) => setMap((m) => ({ ...m, [i]: e.target.value as Field | "" }))}>
                  <option value="">Ignorer</option>
                  {FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      {body.length > 0 && (
        <section className="card">
          <div className="card-h">
            <h2>3. Aperçu</h2>
            <span className="muted">
              {nOk} nouvelle{nOk > 1 ? "s" : ""} · {statuses.filter((s) => s === "dup").length} déjà dans le CRM · {statuses.filter((s) => s === "bad").length} incomplète{statuses.filter((s) => s === "bad").length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="ctable-wrap">
            <table className="ctable">
              <thead>
                <tr>
                  <th>État</th>
                  <th>Nom</th>
                  <th>E-mail</th>
                  <th className="hide-m">Téléphone</th>
                  <th className="hide-m">Source</th>
                  <th className="hide-m">Étiquettes</th>
                </tr>
              </thead>
              <tbody>
                {mapped.slice(0, 12).map((o, i) => (
                  <tr key={i}>
                    <td className={statuses[i] === "ok" ? "prev-ok" : statuses[i] === "dup" ? "prev-dup" : "prev-bad"}>{statuses[i] === "ok" ? "Nouvelle" : statuses[i] === "dup" ? "Doublon" : "Incomplète"}</td>
                    <td>{[o.firstName, o.lastName].filter(Boolean).join(" ") || o.company || "—"}</td>
                    <td>{o.email ?? "—"}</td>
                    <td className="hide-m">{o.phone ?? "—"}</td>
                    <td className="hide-m">{o.source ?? "—"}</td>
                    <td className="hide-m">{o.tags ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mapped.length > 12 && <p className="muted" style={{ fontSize: 13.5 }}>… et {mapped.length - 12} autres lignes.</p>}
          <div className="cgrid" style={{ marginTop: 14 }}>
            <label className="cf">
              <span>Étiquette ajoutée à toutes</span>
              <input className="ci" value={tag} onChange={(e) => setTag(e.target.value)} />
            </label>
            <label className="cf">
              <span>Suivi par</span>
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.first}
                  </option>
                ))}
                <option value="">Personne</option>
              </select>
            </label>
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-ink btn-sm" disabled={busy || nOk === 0} onClick={submit}>
              {busy ? <span className="spin" /> : null}
              Importer {nOk} contact{nOk > 1 ? "s" : ""}
            </button>
            <span className="muted" style={{ fontSize: 13.5, alignSelf: "center" }}>
              Les doublons et les lignes incomplètes sont ignorés.
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
