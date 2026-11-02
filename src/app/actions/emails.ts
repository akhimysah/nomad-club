"use server";

/**
 * E-mails (vague 2) — server actions : désinscription depuis un e-mail, renvoi d'un envoi du journal,
 * envoi d'un e-mail d'essai (aperçu d'un modèle) à sa propre adresse.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { checkCapability } from "@/lib/auth";
import { rateLimitMessage } from "@/lib/modules/securite/rate-limit";
import { TEMPLATES } from "@/lib/modules/emails/templates";
import { isTemplateId } from "@/lib/modules/emails/types";

export type EmailActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Formulaire de la page /e-mails/desinscription (le lien de l'e-mail n'agit jamais seul : il faut confirmer). */
export async function unsubscribeAction(form: FormData): Promise<void> {
  const token = String(form.get("t") ?? "").slice(0, 400);
  const { applyUnsubscribe } = await import("@/lib/modules/emails/unsubscribe-apply");
  const done = await applyUnsubscribe(token);
  redirect(`/e-mails/desinscription?t=${encodeURIComponent(token)}&${done ? "fait=1" : "erreur=1"}`);
}

const idSchema = z.string().min(1).max(64);

export async function resendEmailAction(logId: string): Promise<EmailActionResult> {
  const a = await checkCapability("space.admin");
  if (!a) return { ok: false, error: "Réservé aux administratrices." };
  if (!idSchema.safeParse(logId).success) return { ok: false, error: "Envoi introuvable." };
  const limited = await rateLimitMessage("account", `user:${a.profile.id}`);
  if (limited) return { ok: false, error: limited };
  const { resendLogged } = await import("@/lib/modules/emails/service");
  const r = await resendLogged(logId, a.profile.id);
  if (r.logId)
    await audit({
      actorId: a.profile.id,
      action: "email.resend",
      targetType: "email",
      targetId: r.logId,
      summary: `E-mail renvoyé${r.ok ? "" : " (échec)"}`,
      details: { from: logId, ok: r.ok },
    });
  revalidatePath("/fondatrices/emails");
  return r.ok ? { ok: true, message: "E-mail renvoyé." } : { ok: false, error: r.error };
}

/** Envoie l'exemple d'un modèle à l'adresse de l'administratrice connectée (relecture dans sa vraie messagerie). */
export async function sendTestEmailAction(template: string): Promise<EmailActionResult> {
  const a = await checkCapability("space.admin");
  if (!a) return { ok: false, error: "Réservé aux administratrices." };
  if (!isTemplateId(template)) return { ok: false, error: "Modèle inconnu." };
  if (!a.profile.email) return { ok: false, error: "Votre compte n’a pas d’adresse e-mail." };
  const limited = await rateLimitMessage("account", `user:${a.profile.id}`);
  if (limited) return { ok: false, error: limited };
  const { sendTemplate } = await import("@/lib/modules/emails/service");
  const r = await sendTemplate({ template, to: a.profile.email, data: TEMPLATES[template].sample }, { profileId: a.profile.id, createdBy: a.profile.id });
  revalidatePath("/fondatrices/emails");
  return r.ok ? { ok: true, message: `Exemple envoyé à ${a.profile.email}.` } : { ok: false, error: r.error };
}
