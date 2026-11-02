/**
 * Vague 2 · Contrats — rendu des modèles : variables {{…}}, notes internes, Markdown simplifié → blocs.
 * Les blocs servent à la fois à l'aperçu HTML (composant ContractDocument) et au PDF (pdf.ts).
 * Module pur, sans dépendance (lu aussi par les scripts Node).
 */
import { CONTRACT_VARIABLES } from "./templates.ts";

/** Morceau de texte : gras, ou mention à compléter entre crochets. */
export type Run = { text: string; bold?: boolean; placeholder?: boolean };

export type Block =
  | { t: "h1"; text: string }
  | { t: "h2"; text: string }
  | { t: "h3"; text: string }
  | { t: "p"; runs: Run[] }
  | { t: "ul"; items: Run[][] }
  | { t: "callout"; runs: Run[] }
  | { t: "note"; runs: Run[] }
  | { t: "hr" };

const VAR_RE = /\{\{\s*([a-z_]+(?:\.[a-z_]+)*)\s*\}\}/g;
export const MISSING_VALUE = "[à compléter]";

/** Remplace les variables {{…}} ; une variable inconnue ou vide devient « [à compléter] ». */
export function fillVariables(md: string, vars: Record<string, string>): string {
  return md.replace(VAR_RE, (_, key: string) => {
    const v = vars[key];
    return v != null && v !== "" ? v : MISSING_VALUE;
  });
}

/** Variables utilisées dans un texte mais absentes de la liste connue (avertissement dans l'éditeur). */
export function unknownVariables(md: string): string[] {
  const known = new Set(CONTRACT_VARIABLES.map((v) => v.key));
  const out = new Set<string>();
  for (const m of md.matchAll(VAR_RE)) if (!known.has(m[1])) out.add(m[1]);
  return [...out];
}

/** Retire les notes internes (lignes « >> ») : elles ne vont jamais dans un contrat généré. */
export function stripNotes(md: string): string {
  return md
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith(">>"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Nettoie une valeur saisie par une personne avant de l'injecter dans un modèle :
 * une seule ligne, sans syntaxe Markdown ni accolades (impossible d'ajouter un article ou une variable).
 */
export function cleanValue(v: string | null | undefined): string {
  return (v ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[*{}<>#`|]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 200);
}

/** Texte en ligne → morceaux (gras **…**, mentions [À COMPLÉTER]). */
export function parseInline(s: string): Run[] {
  const runs: Run[] = [];
  const parts = s.split("**");
  parts.forEach((part, i) => {
    if (!part) return;
    const bold = i % 2 === 1;
    let last = 0;
    for (const m of part.matchAll(/\[[^\]\n]{2,120}\]/g)) {
      const at = m.index ?? 0;
      if (at > last) runs.push(bold ? { text: part.slice(last, at), bold } : { text: part.slice(last, at) });
      runs.push(bold ? { text: m[0], bold, placeholder: true } : { text: m[0], placeholder: true });
      last = at + m[0].length;
    }
    if (last < part.length) runs.push(bold ? { text: part.slice(last), bold } : { text: part.slice(last) });
  });
  return runs;
}

const VARIANT_RE = /^\[(MAROC|FRANCE)\]/;

/** Markdown simplifié → blocs. */
export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  let quote: string[] = [];

  const flush = () => {
    if (para.length) blocks.push({ t: "p", runs: parseInline(para.join(" ")) });
    para = [];
    if (list) blocks.push({ t: "ul", items: list.map(parseInline) });
    list = null;
    if (quote.length) blocks.push({ t: "callout", runs: parseInline(quote.join(" ")) });
    quote = [];
  };

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith(">>")) {
      flush();
      blocks.push({ t: "note", runs: parseInline(line.replace(/^>>\s?/, "")) });
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const text = h[2].trim();
      blocks.push(h[1].length === 1 ? { t: "h1", text } : h[1].length === 2 ? { t: "h2", text } : { t: "h3", text });
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      flush();
      blocks.push({ t: "hr" });
      continue;
    }
    if (/^[-•]\s+/.test(line)) {
      if (para.length || quote.length) {
        const keep: string[] | null = list;
        list = null;
        flush();
        list = keep;
      }
      (list ??= []).push(line.replace(/^[-•]\s+/, ""));
      continue;
    }
    if (line.startsWith(">")) {
      if (para.length || list) flush();
      quote.push(line.replace(/^>\s?/, ""));
      continue;
    }
    if (list || quote.length || VARIANT_RE.test(line)) flush();
    para.push(line);
  }
  flush();
  return blocks;
}

/** Texte brut d'un bloc (recherche, tests). */
export function blockText(b: Block): string {
  switch (b.t) {
    case "h1":
    case "h2":
    case "h3":
      return b.text;
    case "p":
    case "callout":
    case "note":
      return b.runs.map((r) => r.text).join("");
    case "ul":
      return b.items.map((it) => it.map((r) => r.text).join("")).join("\n");
    case "hr":
      return "";
  }
}

/** Mentions entre crochets encore présentes (ce que la cliente doit compléter). */
export function placeholdersOf(md: string): string[] {
  const out = new Set<string>();
  for (const line of md.split(/\r?\n/)) {
    if (line.trimStart().startsWith(">>")) continue;
    for (const m of line.matchAll(/\[([^\]\n]{2,120})\]/g)) if (!/^(MAROC|FRANCE)$/.test(m[1])) out.add(m[1]);
  }
  return [...out];
}
