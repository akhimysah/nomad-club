/**
 * Cœur de l'envoi : valide, rend le modèle, ajoute pièces jointes et en-têtes de désinscription,
 * envoie par le fournisseur configuré puis journalise. Ne lève jamais d'erreur.
 */
import type { EmailAttachment, EmailMessage } from "../../mail-hook";
import { generatedAttachments } from "./attachments";
import { emailBaseUrl, emailFrom, emailReplyTo, isEmailAddress, maskEmail, unsubscribeSecret } from "./config";
import { emailLogStore } from "./log-store";
import { createMailer } from "./mailers";
import { renderEmail, templatePrefType, type RenderedEmail } from "./render";
import { signUnsubscribe } from "./unsubscribe";
import { isTemplateId, type Mailer, type OutgoingAttachment, type OutgoingEmail, type SendResult, type TemplateId } from "./types";

export type SendOptions = {
  profileId?: string | null;
  /** Administratrice à l'origine de l'envoi (renvoi manuel). */
  createdBy?: string | null;
  resentFrom?: string | null;
  /** Force le caractère essentiel (pas de lien de désinscription). */
  essential?: boolean;
  /** Ne garde ni les données ni l'adresse complète dans le journal (compte supprimé). */
  forget?: boolean;
  idempotencyKey?: string;
};

export type SendOutcome = { ok: true; id: string | null; logId: string | null } | { ok: false; error: string; logId: string | null };

const MAILER = Symbol.for("nomad-club.emails.mailer");
type G = Record<symbol, Mailer | undefined>;

export function getMailer(): Mailer {
  const g = globalThis as unknown as G;
  return (g[MAILER] ??= createMailer());
}

/** Remplace le fournisseur (tests, outils). */
export function setMailer(m: Mailer | null): void {
  (globalThis as unknown as G)[MAILER] = m ?? undefined;
}

function toBase64(a: EmailAttachment): OutgoingAttachment {
  const content = typeof a.content === "string" ? Buffer.from(a.content, a.encoding === "base64" ? "base64" : "utf8") : Buffer.from(a.content);
  return {
    filename: a.filename.replace(/[\r\n"]/g, "").slice(0, 120) || "piece-jointe",
    contentBase64: content.toString("base64"),
    contentType: a.contentType ?? "application/octet-stream",
    ...(a.contentId ? { contentId: a.contentId } : {}),
  };
}

function jsonSafe(data: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type PreparedEmail = { rendered: RenderedEmail; attachments: OutgoingAttachment[]; headers: Record<string, string>; unsubscribeUrl: string | null };

/** Rend un modèle avec ses pièces jointes et ses en-têtes (sans l'envoyer). */
export async function prepareEmail(
  template: TemplateId,
  data: Record<string, unknown>,
  opts: { profileId?: string | null; essential?: boolean; extra?: EmailAttachment[]; inlineAs?: "cid" | "data"; baseUrl?: string } = {},
): Promise<PreparedEmail> {
  const base = (opts.baseUrl ?? emailBaseUrl()).replace(/\/$/, "");
  const attachments = [...(await generatedAttachments(template, data, base)), ...(opts.extra ?? []).map(toBase64)];
  const inline: Record<string, string> = {};
  for (const a of attachments)
    if (a.contentId) inline[a.contentId] = opts.inlineAs === "data" ? `data:${a.contentType};base64,${a.contentBase64}` : `cid:${a.contentId}`;
  const prefType = templatePrefType(template, data);
  const secret = unsubscribeSecret();
  const canUnsubscribe = !(opts.essential ?? false) && Boolean(opts.profileId && prefType && secret);
  const token = canUnsubscribe ? signUnsubscribe(opts.profileId!, prefType!, secret!) : null;
  const unsubscribeUrl = token ? `${base}/e-mails/desinscription?t=${encodeURIComponent(token)}` : null;
  const rendered = renderEmail(template, data, { baseUrl: base, inline, unsubscribeUrl, essential: opts.essential });
  const headers: Record<string, string> = {};
  if (token && !rendered.essential) {
    headers["List-Unsubscribe"] = `<${base}/api/emails/desinscription?t=${encodeURIComponent(token)}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  return { rendered, attachments, headers, unsubscribeUrl };
}

export type SendJob = { message: EmailMessage; opts?: SendOptions };

type Ready = { i: number; job: SendJob; to: string; template: TemplateId; data: Record<string, unknown>; profileId: string | null; prepared: PreparedEmail; email: OutgoingEmail };

/** Envoie un modèle à une adresse. */
export async function sendTemplate(message: EmailMessage, opts: SendOptions = {}): Promise<SendOutcome> {
  return (await sendTemplates([{ message, opts }]))[0];
}

/**
 * Envoie plusieurs e-mails. Les e-mails sans pièce jointe partent en lots quand le fournisseur le permet
 * (Resend : 100 par requête, ce qui respecte sa limite de fréquence pour les annonces au cercle).
 */
export async function sendTemplates(jobs: SendJob[]): Promise<SendOutcome[]> {
  const out: SendOutcome[] = new Array(jobs.length);
  const ready: Ready[] = [];
  let mailer: Mailer;
  try {
    mailer = getMailer();
  } catch (e) {
    const error = `Fournisseur indisponible : ${e instanceof Error ? e.message : String(e)}`;
    return jobs.map(() => ({ ok: false, error, logId: null }));
  }
  for (const [i, job] of jobs.entries()) {
    const { message } = job;
    const opts = job.opts ?? {};
    const to = (message.to ?? "").trim().toLowerCase();
    if (!isTemplateId(message.template)) {
      out[i] = { ok: false, error: `Modèle inconnu : ${String(message.template)}`, logId: null };
      continue;
    }
    if (!isEmailAddress(to)) {
      out[i] = { ok: false, error: "Adresse e-mail invalide.", logId: null };
      continue;
    }
    const template = message.template;
    const data = jsonSafe(message.data ?? {});
    const profileId = opts.profileId ?? message.profileId ?? null;
    try {
      const prepared = await prepareEmail(template, data, { profileId, essential: opts.essential, extra: message.attachments });
      const { rendered, attachments, headers } = prepared;
      const email: OutgoingEmail = {
        from: emailFrom(),
        to,
        replyTo: emailReplyTo(),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers,
        attachments,
        tags: { template, app: "nomad-club" },
        idempotencyKey: opts.idempotencyKey ?? message.idempotencyKey,
      };
      ready.push({ i, job, to, template, data, profileId, prepared, email });
    } catch (e) {
      const error = `Rendu impossible : ${e instanceof Error ? e.message : String(e)}`;
      console.error("[e-mails]", template, error);
      out[i] = { ok: false, error, logId: null };
    }
  }

  const results = new Map<number, SendResult>();
  const batchable = mailer.sendBatch ? ready.filter((r) => !r.email.attachments?.length && !r.email.idempotencyKey) : [];
  if (batchable.length > 1 && mailer.sendBatch) {
    const res = await mailer.sendBatch(batchable.map((r) => r.email));
    batchable.forEach((r, k) => results.set(r.i, res[k] ?? { ok: false, error: "Réponse du fournisseur incomplète." }));
  }
  for (const r of ready) if (!results.has(r.i)) results.set(r.i, await mailer.send(r.email));

  const store = emailLogStore();
  for (const r of ready) {
    const result = results.get(r.i)!;
    const opts = r.job.opts ?? {};
    if (!result.ok) console.error(`[e-mails] échec ${r.template} → ${maskEmail(r.to)} : ${result.error}`);
    let logId: string | null = null;
    try {
      const row = await store.insert({
        profileId: opts.forget ? null : r.profileId,
        toEmail: opts.forget ? maskEmail(r.to) : r.to,
        template: r.template,
        subject: r.prepared.rendered.subject,
        status: result.ok ? "sent" : "failed",
        provider: mailer.name,
        providerId: result.ok ? result.id : null,
        error: result.ok ? null : result.error,
        data: opts.forget ? {} : opts.essential ? { ...r.data, __essential: true } : r.data,
        attachments: (r.email.attachments ?? []).map((a) => a.filename),
        resentFrom: opts.resentFrom ?? null,
        createdBy: opts.createdBy ?? null,
      });
      logId = row?.id ?? null;
    } catch (e) {
      console.error("[e-mails] journal :", e instanceof Error ? e.message : e);
    }
    out[r.i] = result.ok ? { ok: true, id: result.id, logId } : { ok: false, error: result.error, logId };
  }
  return out;
}

/** Renvoie un e-mail du journal (mêmes données, pièces jointes régénérées ; pièces jointes externes non conservées). */
export async function resendLogged(id: string, actorId: string): Promise<SendOutcome> {
  const entry = await emailLogStore().get(id);
  if (!entry) return { ok: false, error: "Envoi introuvable.", logId: null };
  if (!isTemplateId(entry.template)) return { ok: false, error: "Modèle inconnu.", logId: null };
  if (!isEmailAddress(entry.toEmail) || !Object.keys(entry.data).length) return { ok: false, error: "Cet envoi n’a pas été conservé (compte supprimé) : impossible de le renvoyer.", logId: null };
  const { __essential, ...data } = entry.data;
  return sendTemplate(
    { template: entry.template, to: entry.toEmail, data },
    { profileId: entry.profileId, createdBy: actorId, resentFrom: entry.id, essential: __essential === true ? true : undefined },
  );
}
