/**
 * Petit générateur de PDF (texte seul, Helvetica, encodage WinAnsi) pour les fichiers d'exemple de la démo.
 * Aucun fichier n'est stocké dans /public : le PDF est fabriqué à la volée par la route de téléchargement,
 * après vérification de l'achat, et porte le nom de l'acheteuse.
 */

type Line = { text: string; size: number; bold?: boolean; gap?: number };

const WIN_ANSI: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "œ": 0x9c, "Œ": 0x8c, " ": 0x20, " ": 0x20,
};

/** Chaîne PDF littérale (octets WinAnsi, caractères spéciaux échappés). */
function pdfString(s: string): string {
  let out = "(";
  for (const ch of s) {
    let code = WIN_ANSI[ch] ?? ch.codePointAt(0) ?? 63;
    if (code > 255) code = 63; // « ? »
    if (ch === "(" || ch === ")" || ch === "\\") out += "\\" + ch;
    else if (code < 32 || code > 126) out += "\\" + code.toString(8).padStart(3, "0");
    else out += String.fromCharCode(code);
  }
  return out + ")";
}

/** Découpe un paragraphe en lignes d'environ `max` caractères. */
function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export type PdfDoc = { title: string; subtitle?: string | null; paragraphs: string[]; footer: string };

export function renderPdf(doc: PdfDoc): Uint8Array {
  const W = 595;
  const H = 842;
  const M = 64;
  const lines: Line[] = [
    { text: "MARRAKECH NOMAD CLUB", size: 9, bold: true, gap: 34 },
    ...wrap(doc.title, 34).map((t) => ({ text: t, size: 26, bold: true, gap: 32 })),
    ...(doc.subtitle ? wrap(doc.subtitle, 60).map((t) => ({ text: t, size: 13, gap: 30 })) : []),
  ];
  for (const p of doc.paragraphs) {
    const head = p.startsWith("# ");
    const body = head ? p.slice(2) : p;
    wrap(body, head ? 60 : 88).forEach((t, i, arr) => lines.push({ text: t, size: head ? 14 : 11, bold: head, gap: i === arr.length - 1 ? (head ? 20 : 18) : head ? 18 : 15 }));
  }

  // pagination
  const pages: Line[][] = [[]];
  let y = H - M;
  for (const l of lines) {
    if (y - (l.gap ?? 16) < M + 40) {
      pages.push([]);
      y = H - M;
    }
    pages[pages.length - 1].push(l);
    y -= l.gap ?? 16;
  }

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length; // numéro de l'objet
  };
  const catalog = add("");
  const pagesObj = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontB = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  pages.forEach((pl, pi) => {
    let yy = H - M;
    let content = "BT\n";
    for (const l of pl) {
      content += `/${l.bold ? "F2" : "F1"} ${l.size} Tf 1 0 0 1 ${M} ${yy.toFixed(1)} Tm ${pdfString(l.text)} Tj\n`;
      yy -= l.gap ?? 16;
    }
    content += `/F1 8 Tf 1 0 0 1 ${M} ${M - 10} Tm ${pdfString(`${doc.footer} · page ${pi + 1}/${pages.length}`)} Tj\nET\n`;
    content += `0.6 G 0.5 w ${M} ${M + 4} m ${W - M} ${M + 4} l S\n`;
    const stream = add(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${font} 0 R /F2 ${fontB} 0 R >> >> /Contents ${stream} 0 R >>`));
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}
