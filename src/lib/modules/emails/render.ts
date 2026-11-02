/**
 * Rendu d'un modèle en e-mail complet (objet, HTML, texte brut). Module pur.
 */
import { layoutHtml, layoutText } from "./layout.ts";
import { TEMPLATES, type RenderContext } from "./templates.ts";
import type { TemplateId } from "./types.ts";

export type RenderOptions = RenderContext & {
  /** Lien de désinscription en un clic (ajouté seulement aux e-mails non essentiels). */
  unsubscribeUrl?: string | null;
  /** Force le caractère essentiel (ex. notification « accès » relayée par le modèle générique). */
  essential?: boolean;
};

export type RenderedEmail = { subject: string; preheader: string; html: string; text: string; essential: boolean; prefType: string | null };

/** Préférence de notifications qui coupe ce modèle pour ces données (null : aucune). */
export function templatePrefType(id: TemplateId, data: unknown): string | null {
  const t = TEMPLATES[id];
  return t.prefTypeOf ? t.prefTypeOf(data) : t.prefType;
}

export function renderEmail(id: TemplateId, data: unknown, opts: RenderOptions): RenderedEmail {
  const t = TEMPLATES[id];
  const parts = t.build(data, opts);
  const essential = opts.essential ?? t.essential;
  const prefType = templatePrefType(id, data);
  const base = opts.baseUrl.replace(/\/$/, "");
  const layout = {
    preheader: parts.preheader,
    blocks: parts.blocks,
    baseUrl: base,
    essential,
    unsubscribeUrl: essential ? null : (opts.unsubscribeUrl ?? null),
    prefsUrl: `${base}/espace/notifications`,
    reason: parts.reason,
  };
  const subject = parts.subject.replace(/\s+/g, " ").trim().slice(0, 180);
  return { subject, preheader: parts.preheader, html: layoutHtml(layout, subject), text: layoutText(layout), essential, prefType };
}
