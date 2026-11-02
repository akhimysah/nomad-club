/** Choix du fournisseur d'envoi selon l'environnement (voir ../config.ts). */
import { emailProvider } from "../config.ts";
import type { Mailer } from "../types.ts";
import { createConsoleMailer } from "./console.ts";
import { createResendMailer } from "./resend.ts";
import { createSmtpMailer } from "./smtp.ts";

export function createMailer(env: Record<string, string | undefined> = process.env): Mailer {
  const provider = emailProvider(env);
  if (provider === "resend" && env.RESEND_API_KEY) return createResendMailer(env.RESEND_API_KEY);
  if (provider === "smtp") return createSmtpMailer(env);
  return createConsoleMailer();
}
