/**
 * Fournisseur SMTP (prévu, non activé) : EMAIL_PROVIDER=smtp.
 *
 * Pour l'activer (ex. Google Workspace, OVH, ou le SMTP de Resend : smtp.resend.com:465, utilisateur « resend »,
 * mot de passe = RESEND_API_KEY) :
 *   1. `npm install nodemailer @types/nodemailer` ;
 *   2. remplacer le corps de `send` par :
 *        const nodemailer = await import("nodemailer");
 *        const port = Number(env.SMTP_PORT ?? 465);
 *        const t = nodemailer.createTransport({ host: env.SMTP_HOST, port, secure: port === 465,
 *          auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } });
 *        const info = await t.sendMail({ from: email.from, to: email.to, replyTo: email.replyTo ?? undefined,
 *          subject: email.subject, html: email.html, text: email.text, headers: email.headers,
 *          attachments: email.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.contentBase64, "base64"),
 *            contentType: a.contentType, cid: a.contentId })) });
 *        return { ok: true, id: info.messageId };
 *   3. renseigner SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD.
 * Voir docs/emails.md. Tant que ce n'est pas fait, chaque envoi est journalisé en échec (rien n'est perdu
 * silencieusement) : préférer Resend par l'API.
 */
import type { Mailer, OutgoingEmail, SendResult } from "../types.ts";

export function createSmtpMailer(env: Record<string, string | undefined> = process.env): Mailer {
  const configured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
  return {
    name: "smtp",
    async send(email: OutgoingEmail): Promise<SendResult> {
      void email;
      return {
        ok: false,
        error: configured
          ? "SMTP prévu mais non installé : voir src/lib/modules/emails/mailers/smtp.ts (nodemailer)."
          : "SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) : voir docs/emails.md.",
      };
    },
  };
}
