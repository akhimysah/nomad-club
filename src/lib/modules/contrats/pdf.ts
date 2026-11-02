/**
 * Vague 2 · Contrats — mise en page PDF (pdf-lib, côté serveur), dans la charte noir et blanc du club :
 * titres en Times (serif, écho de Playfair Display), texte en Helvetica, filets fins, pied de page numéroté.
 *
 * Le rendu est DÉTERMINISTE : mêmes données → mêmes octets (dates de métadonnées = date du contrat, pas de
 * date « maintenant »). C'est ce qui permet de régénérer le PDF à la volée en démo et de vérifier son
 * empreinte SHA-256 à tout moment.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { Block, Run } from "./render.ts";

const A4: [number, number] = [595.28, 841.89];
const M = { left: 64, right: 64, top: 78, bottom: 72 };
const W = A4[0] - M.left - M.right;
const INK = rgb(0.07, 0.07, 0.07);
const GREY = rgb(0.42, 0.42, 0.42);
const LIGHT = rgb(0.78, 0.78, 0.78);
const PH_BG = rgb(0.93, 0.93, 0.93);

type Fonts = { body: PDFFont; bold: PDFFont; italic: PDFFont; serif: PDFFont; serifBold: PDFFont };

export type PdfMeta = {
  /** Titre du document (h1 du contrat ou du certificat). */
  title: string;
  /** Ligne d'en-tête à droite (« Contrat n° NC-ADH-2026-… »). */
  headerRight: string;
  /** Pied de page à gauche. */
  footerLeft: string;
  /** Date ISO fixe (création du contrat) : métadonnées déterministes. */
  date: string;
  subject?: string;
};

/** Caractères que la police standard sait encoder ; les autres deviennent « ? ». Espaces insécables → espace. */
function sanitizer(font: PDFFont): (s: string) => string {
  const ok = new Set(font.getCharacterSet());
  return (s) => {
    let out = "";
    for (const ch of s.replace(/[    ]/g, " ").replace(/[‐‑]/g, "-")) {
      const cp = ch.codePointAt(0) ?? 63;
      out += ok.has(cp) ? ch : "?";
    }
    return out;
  };
}

type Word = { text: string; font: PDFFont; size: number; ph: boolean; space: boolean };

class Writer {
  doc: PDFDocument;
  f: Fonts;
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  clean: (s: string) => string;
  meta: PdfMeta;

  constructor(doc: PDFDocument, f: Fonts, meta: PdfMeta) {
    this.doc = doc;
    this.f = f;
    this.meta = meta;
    this.clean = sanitizer(f.body);
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    const top = A4[1] - 46;
    let x = M.left;
    for (const ch of "NOMAD CLUB") {
      this.page.drawText(ch, { x, y: top, size: 8.5, font: this.f.serifBold, color: INK });
      x += this.f.serifBold.widthOfTextAtSize(ch, 8.5) + 2.6;
    }
    const hr = this.clean(this.meta.headerRight);
    this.page.drawText(hr, { x: A4[0] - M.right - this.f.body.widthOfTextAtSize(hr, 7.5), y: top + 0.5, size: 7.5, font: this.f.body, color: GREY });
    this.page.drawLine({ start: { x: M.left, y: top - 9 }, end: { x: A4[0] - M.right, y: top - 9 }, thickness: 0.6, color: INK });
    this.y = A4[1] - M.top;
  }

  ensure(h: number) {
    if (this.y - h < M.bottom) this.newPage();
  }

  /** Découpe des morceaux de texte en mots mesurables (les espaces insécables restent dans le mot). */
  words(runs: Run[], size: number, base: "body" | "italic" = "body"): Word[] {
    const out: Word[] = [];
    for (const r of runs) {
      const font = r.bold ? this.f.bold : base === "italic" ? this.f.italic : this.f.body;
      const parts = r.text.split(" ");
      parts.forEach((p, i) => {
        if (p === "") {
          if (out.length) out[out.length - 1].space = true;
          return;
        }
        out.push({ text: this.clean(p), font, size, ph: !!r.placeholder, space: i < parts.length - 1 });
      });
    }
    return out;
  }

  /** Paragraphe justifié à gauche avec retour à la ligne, gras et mentions à compléter surlignées. */
  flow(words: Word[], opts: { x?: number; width?: number; leading: number; color?: ReturnType<typeof rgb> }) {
    const x0 = opts.x ?? M.left;
    const width = opts.width ?? W;
    // unités insécables : un mot collé au précédent (« [SIÈGE], ») ne passe jamais seul à la ligne
    const units: Word[][] = [];
    words.forEach((w, i) => {
      if (i > 0 && !words[i - 1].space && units.length) units[units.length - 1].push(w);
      else units.push([w]);
    });
    const unitWidth = (u: Word[]) => u.reduce((a, w) => a + w.font.widthOfTextAtSize(w.text, w.size), 0);
    const lines: Word[][] = [];
    let line: Word[] = [];
    let lw = 0;
    for (const u of units) {
      const uw = unitWidth(u);
      const sp = line.length ? u[0].font.widthOfTextAtSize(" ", u[0].size) : 0;
      if (line.length && lw + sp + uw > width) {
        lines.push(line);
        line = [...u];
        lw = uw;
      } else {
        line.push(...u);
        lw += sp + uw;
      }
    }
    if (line.length) lines.push(line);
    for (const l of lines) {
      this.ensure(opts.leading);
      let x = x0;
      const base = this.y - opts.leading * 0.78;
      l.forEach((w, i) => {
        const ww = w.font.widthOfTextAtSize(w.text, w.size);
        if (w.ph) this.page.drawRectangle({ x: x - 1, y: base - 2.2, width: ww + 2, height: w.size + 2.6, color: PH_BG });
        this.page.drawText(w.text, { x, y: base, size: w.size, font: w.font, color: opts.color ?? INK });
        x += ww;
        if (w.space && i < l.length - 1) x += w.font.widthOfTextAtSize(" ", w.size);
      });
      this.y -= opts.leading;
    }
  }

  gap(h: number) {
    this.y -= h;
  }

  rule(color = LIGHT, thickness = 0.5) {
    this.ensure(8);
    this.page.drawLine({ start: { x: M.left, y: this.y }, end: { x: A4[0] - M.right, y: this.y }, thickness, color });
  }

  heading(text: string, font: PDFFont, size: number, before: number, after: number) {
    this.gap(before);
    this.ensure(size * 1.3 + 46); // garder le titre avec au moins trois lignes de texte
    this.flow(this.words([{ text }], size).map((w) => ({ ...w, font })), { leading: size * 1.3 });
    this.gap(after);
  }

  footers() {
    const n = this.pages.length;
    this.pages.forEach((p, i) => {
      const y = M.bottom - 30;
      p.drawLine({ start: { x: M.left, y: y + 12 }, end: { x: A4[0] - M.right, y: y + 12 }, thickness: 0.4, color: LIGHT });
      const left = this.clean(this.meta.footerLeft);
      p.drawText(left, { x: M.left, y, size: 7, font: this.f.body, color: GREY });
      const right = `page ${i + 1} / ${n}`;
      p.drawText(right, { x: A4[0] - M.right - this.f.body.widthOfTextAtSize(right, 7), y, size: 7, font: this.f.body, color: GREY });
    });
  }
}

async function open(meta: PdfMeta): Promise<{ doc: PDFDocument; w: Writer }> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const d = new Date(meta.date);
  doc.setTitle(meta.title);
  doc.setAuthor("Nomad Club");
  doc.setSubject(meta.subject ?? meta.title);
  doc.setCreator("Application Nomad Club");
  doc.setProducer("Nomad Club · pdf-lib");
  doc.setLanguage("fr-FR");
  doc.setCreationDate(d);
  doc.setModificationDate(d);
  const f: Fonts = {
    body: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };
  return { doc, w: new Writer(doc, f, meta) };
}

const BODY = 9.6;
const LEAD = 14;

/** Contrat complet : blocs (variables déjà remplies, notes retirées) → octets PDF. */
export async function renderContractPdf(blocks: Block[], meta: PdfMeta & { closing: string }): Promise<Uint8Array> {
  const { doc, w } = await open(meta);
  let first = true;
  for (const b of blocks) {
    switch (b.t) {
      case "h1":
        w.heading(b.text, w.f.serif, first ? 22 : 17, first ? 4 : 18, 4);
        first = false;
        break;
      case "h2":
        w.heading(b.text, w.f.serifBold, 12.4, 13, 3);
        break;
      case "h3":
        w.heading(b.text, w.f.bold, 10, 8, 2);
        break;
      case "p": {
        // première ligne sous le titre (numéro, date, version) : petite et grise
        const meta = b.runs.length && /^Contrat n° /.test(b.runs[0].text);
        w.flow(w.words(b.runs, meta ? 8.6 : BODY), { leading: meta ? 12 : LEAD, color: meta ? GREY : INK });
        w.gap(meta ? 10 : 5);
        if (meta) {
          w.rule(INK, 0.6);
          w.gap(8);
        }
        break;
      }
      case "ul":
        for (const it of b.items) {
          w.ensure(LEAD);
          w.page.drawText("–", { x: M.left + 3, y: w.y - LEAD * 0.78, size: BODY, font: w.f.body, color: INK });
          w.flow(w.words(it, BODY), { x: M.left + 16, width: W - 16, leading: LEAD });
          w.gap(1.5);
        }
        w.gap(4);
        break;
      case "callout": {
        w.gap(2);
        const top = w.y;
        const startPage = w.page;
        w.flow(w.words(b.runs, BODY, "italic"), { x: M.left + 12, width: W - 12, leading: LEAD });
        if (w.page === startPage) startPage.drawLine({ start: { x: M.left + 1, y: top - 2 }, end: { x: M.left + 1, y: w.y + 2 }, thickness: 1.4, color: INK });
        w.gap(6);
        break;
      }
      case "note":
        break; // jamais dans un contrat généré
      case "hr":
        w.gap(4);
        w.rule();
        w.gap(8);
        break;
    }
  }
  // encadré final : comment le document est accepté
  w.gap(14);
  w.ensure(70);
  const top = w.y;
  w.gap(10);
  w.flow(w.words([{ text: "Acceptation électronique", bold: true }], 9), { x: M.left + 12, width: W - 24, leading: 13 });
  w.flow(w.words([{ text: meta.closing }], 8.4), { x: M.left + 12, width: W - 24, leading: 12, color: GREY });
  w.gap(10);
  w.page.drawRectangle({ x: M.left, y: w.y, width: W, height: top - w.y, borderColor: INK, borderWidth: 0.6 });
  w.footers();
  return doc.save({ useObjectStreams: false });
}

/** Certificat d'acceptation : récapitulatif de la preuve (généré à la demande, n'altère pas le contrat). */
export async function renderCertificatePdf(rows: Array<[string, string]>, meta: PdfMeta & { intro: string }): Promise<Uint8Array> {
  const { doc, w } = await open(meta);
  w.heading(meta.title, w.f.serif, 20, 4, 6);
  w.flow(w.words([{ text: meta.intro }], BODY), { leading: LEAD, color: GREY });
  w.gap(10);
  w.rule(INK, 0.6);
  w.gap(10);
  for (const [k, v] of rows) {
    w.ensure(LEAD * 2);
    const y0 = w.y;
    w.flow(w.words([{ text: k, bold: true }], 8.6), { width: 150, leading: 12.5 });
    const yk = w.y;
    w.y = y0;
    w.flow(w.words([{ text: v.split(" ").map((t) => (t.length > 40 ? (t.match(/.{1,32}/g) ?? [t]).join(" ") : t)).join(" ") }], 8.6), { x: M.left + 160, width: W - 160, leading: 12.5 });
    w.y = Math.min(w.y, yk);
    w.gap(5);
    w.rule();
    w.gap(6);
  }
  w.footers();
  return doc.save({ useObjectStreams: false });
}
