/**
 * Mise en page des e-mails (rendu maison, sans dépendance) : tableaux + styles en ligne, compatibles
 * Gmail, Apple Mail, Outlook. Chaque bloc produit sa version HTML et sa version texte brut.
 * Design : noir et blanc de la marque, logotype clair sur bandeau sombre, polices de secours web-safe
 * (Georgia pour les titres à la place de Playfair Display, Helvetica / Arial pour le texte).
 */

export type Block =
  | { t: "h1"; text: string }
  | { t: "p"; text: string }
  | { t: "button"; label: string; url: string }
  | { t: "details"; rows: Array<[string, string]> }
  | { t: "ticket"; code: string; qrSrc: string | null; url: string; label?: string }
  | { t: "quote"; text: string; title?: string }
  | { t: "list"; items: string[] }
  | { t: "note"; text: string }
  | { t: "divider" };

export type LayoutInput = {
  /** Texte d'aperçu affiché par la messagerie à côté de l'objet. */
  preheader: string;
  blocks: Block[];
  baseUrl: string;
  /** E-mail essentiel (billet, reçu, contrat, sécurité) : pas de lien de désinscription. */
  essential: boolean;
  /** Lien de désinscription en un clic (e-mails non essentiels). */
  unsubscribeUrl?: string | null;
  /** Page des préférences de notifications. */
  prefsUrl?: string | null;
  /** Raison de l'envoi, affichée en pied de page. */
  reason?: string;
};

const INK = "#111111";
const PAPER = "#ffffff";
const BG = "#f3f2ef";
const MUTED = "#6b6b6b";
const LINE = "#e6e4df";
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** N'accepte que des adresses http(s), mailto, cid ou des images en data: (aperçu). */
export function safeUrl(u: string): string {
  const s = u.trim();
  if (/^(https?:|mailto:|cid:)/i.test(s) || /^data:image\/(png|gif|jpeg);base64,/i.test(s)) return s;
  return "#";
}

const nl2br = (s: string) => esc(s).replace(/\r?\n/g, "<br>");

function blockHtml(b: Block): string {
  switch (b.t) {
    case "h1":
      return `<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:28px;line-height:1.2;font-weight:normal;color:${INK};">${esc(b.text)}</h1>`;
    case "p":
      return `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${INK};">${nl2br(b.text)}</p>`;
    case "button":
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td bgcolor="${INK}" style="border-radius:999px;background:${INK};">
<a href="${esc(safeUrl(b.url))}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:15px;font-weight:bold;letter-spacing:.02em;color:${PAPER};text-decoration:none;border-radius:999px;">${esc(b.label)}</a>
</td></tr></table>`;
    case "details":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;border-top:1px solid ${LINE};">${b.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:11px 12px 11px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:14px;color:${MUTED};vertical-align:top;width:38%;">${esc(k)}</td><td style="padding:11px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:15px;color:${INK};font-weight:bold;vertical-align:top;">${nl2br(v)}</td></tr>`,
        )
        .join("")}</table>`;
    case "ticket":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;border:1px solid ${INK};border-radius:16px;"><tr><td align="center" style="padding:24px 16px;">
<p style="margin:0 0 6px;font-family:${SANS};font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${MUTED};">${esc(b.label ?? "Ton billet")}</p>
<p style="margin:0 0 14px;font-family:'Courier New',Courier,monospace;font-size:26px;letter-spacing:.2em;font-weight:bold;color:${INK};">${esc(b.code)}</p>
${b.qrSrc ? `<img src="${esc(safeUrl(b.qrSrc))}" width="168" height="168" alt="QR code du billet ${esc(b.code)}" style="display:block;margin:0 auto 14px;width:168px;height:168px;border:0;">` : ""}
<a href="${esc(safeUrl(b.url))}" target="_blank" style="font-family:${SANS};font-size:14px;color:${INK};text-decoration:underline;">Ouvrir le billet dans l’appli</a>
</td></tr></table>`;
    case "quote":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td style="border-left:3px solid ${INK};padding:4px 0 4px 16px;">
${b.title ? `<p style="margin:0 0 6px;font-family:${SERIF};font-size:19px;line-height:1.3;color:${INK};">${esc(b.title)}</p>` : ""}
<p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:#333333;">${nl2br(b.text)}</p>
</td></tr></table>`;
    case "list":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">${b.items
        .map(
          (i) =>
            `<tr><td width="18" style="vertical-align:top;font-family:${SANS};font-size:16px;line-height:1.6;color:${INK};">·</td><td style="font-family:${SANS};font-size:15px;line-height:1.6;color:${INK};padding-bottom:4px;">${nl2br(i)}</td></tr>`,
        )
        .join("")}</table>`;
    case "note":
      return `<p style="margin:0 0 14px;font-family:${SANS};font-size:13px;line-height:1.55;color:${MUTED};">${nl2br(b.text)}</p>`;
    case "divider":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;"><tr><td style="border-top:1px solid ${LINE};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
  }
}

function blockText(b: Block): string {
  switch (b.t) {
    case "h1":
      return `${b.text}\n${"=".repeat(Math.min(b.text.length, 60))}`;
    case "p":
    case "note":
      return b.text;
    case "button":
      return `${b.label} : ${b.url}`;
    case "details":
      return b.rows.map(([k, v]) => `${k} : ${v.replace(/\n/g, ", ")}`).join("\n");
    case "ticket":
      return `${b.label ?? "Ton billet"} : ${b.code}\nBillet et QR code : ${b.url}`;
    case "quote":
      return [b.title ? `« ${b.title} »` : "", b.text].filter(Boolean).join("\n");
    case "list":
      return b.items.map((i) => `- ${i}`).join("\n");
    case "divider":
      return "----";
  }
}

/** Assemble le document HTML complet. */
export function layoutHtml(input: LayoutInput, subject: string): string {
  const base = input.baseUrl.replace(/\/$/, "");
  const footerLinks = [
    input.prefsUrl ? `<a href="${esc(safeUrl(input.prefsUrl))}" style="color:${MUTED};text-decoration:underline;">Gérer mes notifications</a>` : "",
    !input.essential && input.unsubscribeUrl ? `<a href="${esc(safeUrl(input.unsubscribeUrl))}" style="color:${MUTED};text-decoration:underline;">Ne plus recevoir ces e-mails</a>` : "",
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};font-size:1px;line-height:1px;">${esc(input.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background:${BG};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${PAPER};border-radius:18px;overflow:hidden;">
<tr><td bgcolor="${INK}" align="center" style="background:${INK};padding:26px 24px;">
<a href="${esc(safeUrl(base + "/"))}" target="_blank" style="text-decoration:none;"><img src="${esc(safeUrl(base + "/img/logotype-clair.png"))}" width="180" alt="NOMAD CLUB" style="display:block;width:180px;max-width:60%;height:auto;border:0;color:${PAPER};font-family:${SERIF};font-size:22px;letter-spacing:.24em;"></a>
</td></tr>
<tr><td style="padding:36px 32px 18px;">
${input.blocks.map(blockHtml).join("\n")}
</td></tr>
<tr><td style="padding:0 32px 30px;">
<p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK};">À très vite,<br><span style="font-family:${SERIF};font-size:17px;">Julia et Nora</span></p>
</td></tr>
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td align="center" style="padding:20px 24px 8px;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED};">
Nomad Club · Le cercle des femmes entrepreneuses à Marrakech${input.reason ? `<br>${esc(input.reason)}` : ""}${footerLinks ? `<br>${footerLinks}` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Version texte brut (clients sans HTML, filtres anti-spam). */
export function layoutText(input: LayoutInput): string {
  const parts = input.blocks.map(blockText);
  parts.push("À très vite,\nJulia et Nora");
  const foot = ["--", "Nomad Club · Le cercle des femmes entrepreneuses à Marrakech"];
  if (input.reason) foot.push(input.reason);
  if (input.prefsUrl) foot.push(`Gérer mes notifications : ${input.prefsUrl}`);
  if (!input.essential && input.unsubscribeUrl) foot.push(`Ne plus recevoir ces e-mails : ${input.unsubscribeUrl}`);
  parts.push(foot.join("\n"));
  return parts.join("\n\n") + "\n";
}
