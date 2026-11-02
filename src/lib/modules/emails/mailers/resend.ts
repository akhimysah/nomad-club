/**
 * Fournisseur Resend (https://resend.com) par l'API HTTP, sans SDK : POST https://api.resend.com/emails.
 * Clé : RESEND_API_KEY (« re_… », droit « Sending access » limité au domaine d'envoi).
 */
import type { Mailer, OutgoingEmail, SendResult } from "../types.ts";

const ENDPOINT = "https://api.resend.com/emails";
/** Lot de 100 e-mails au plus, sans pièces jointes. */
export const RESEND_BATCH_MAX = 100;

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Corps de la requête Resend (exporté pour les tests). */
export function resendPayload(email: OutgoingEmail): Record<string, unknown> {
  return {
    from: email.from,
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
    ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    ...(email.headers && Object.keys(email.headers).length ? { headers: email.headers } : {}),
    ...(email.attachments?.length
      ? {
          attachments: email.attachments.map((a) => ({
            filename: a.filename,
            content: a.contentBase64,
            content_type: a.contentType,
            ...(a.contentId ? { content_id: a.contentId } : {}),
          })),
        }
      : {}),
    ...(email.tags ? { tags: Object.entries(email.tags).map(([name, value]) => ({ name, value: value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) })) } : {}),
  };
}

export function createResendMailer(apiKey: string, fetchImpl: FetchLike = fetch as unknown as FetchLike): Mailer {
  const baseHeaders = () => ({ Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "User-Agent": "nomad-club/1.0" }) as Record<string, string>;
  return {
    name: "resend",
    async sendBatch(emails: OutgoingEmail[]): Promise<SendResult[]> {
      const out: SendResult[] = [];
      for (let i = 0; i < emails.length; i += RESEND_BATCH_MAX) {
        const chunk = emails.slice(i, i + RESEND_BATCH_MAX);
        try {
          const res = await fetchImpl(`${ENDPOINT}/batch`, {
            method: "POST",
            headers: baseHeaders(),
            body: JSON.stringify(chunk.map((e) => resendPayload({ ...e, attachments: undefined }))),
            signal: AbortSignal.timeout(20000),
          });
          const body = (await res.json().catch(() => ({}))) as { data?: Array<{ id?: string }>; message?: string; name?: string };
          if (!res.ok) {
            const error = `Resend ${res.status} : ${body.message ?? body.name ?? "erreur inconnue"}`.slice(0, 500);
            out.push(...chunk.map(() => ({ ok: false as const, error })));
          } else out.push(...chunk.map((_, j) => ({ ok: true as const, id: body.data?.[j]?.id ?? null })));
        } catch (e) {
          const error = `Resend injoignable : ${e instanceof Error ? e.message : String(e)}`.slice(0, 500);
          out.push(...chunk.map(() => ({ ok: false as const, error })));
        }
      }
      return out;
    },
    async send(email: OutgoingEmail): Promise<SendResult> {
      try {
        const headers = baseHeaders();
        if (email.idempotencyKey) headers["Idempotency-Key"] = email.idempotencyKey.slice(0, 256);
        const res = await fetchImpl(ENDPOINT, { method: "POST", headers, body: JSON.stringify(resendPayload(email)), signal: AbortSignal.timeout(10000) });
        const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
        if (!res.ok) return { ok: false, error: `Resend ${res.status} : ${body.message ?? body.name ?? "erreur inconnue"}`.slice(0, 500) };
        return { ok: true, id: body.id ?? null };
      } catch (e) {
        return { ok: false, error: `Resend injoignable : ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) };
      }
    },
  };
}
