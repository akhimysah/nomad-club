/**
 * Fournisseur SMTP : EMAIL_PROVIDER=smtp, avec SMTP_HOST, SMTP_PORT (465 par défaut), SMTP_USER, SMTP_PASSWORD.
 * Ex. Gmail du club : smtp.gmail.com, 465, l'adresse Gmail et un « mot de passe d'application » Google
 * (pas le mot de passe du compte). Gmail limite à environ 500 envois par jour. Voir docs/emails.md.
 */
import type { Mailer, OutgoingEmail, SendResult } from "../types.ts";

type Env = Record<string, string | undefined>;

export function createSmtpMailer(env: Env = process.env): Mailer {
  const configured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
  let transport: Promise<import("nodemailer").Transporter> | null = null;
  const getTransport = () => {
    transport ??= import("nodemailer").then((m) => {
      const port = Number(env.SMTP_PORT ?? 465);
      return m.default.createTransport({
        host: env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: env.SMTP_USER, pass: (env.SMTP_PASSWORD ?? "").replace(/\s+/g, "") },
        pool: true,
        maxConnections: 2,
      });
    });
    return transport;
  };
  return {
    name: "smtp",
    async send(email: OutgoingEmail): Promise<SendResult> {
      if (!configured) return { ok: false, error: "SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) : voir docs/emails.md." };
      try {
        const t = await getTransport();
        const info = await t.sendMail({
          from: email.from,
          to: email.to,
          replyTo: email.replyTo ?? undefined,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: email.headers,
          attachments: email.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.contentBase64, "base64"), contentType: a.contentType, cid: a.contentId })),
        });
        return { ok: true, id: info.messageId };
      } catch (e) {
        transport = null; // nouvelle connexion au prochain envoi
        return { ok: false, error: `SMTP : ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}
