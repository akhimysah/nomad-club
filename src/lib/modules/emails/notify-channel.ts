/**
 * Canal e-mail des notifications (appelé par `deliverExternally` dans src/lib/notify.ts).
 * Lit les adresses et les préférences « e-mail » des destinataires, applique les règles de ./channel.ts
 * puis envoie. Ne lève jamais d'erreur. En mode réel, la lecture des autres comptes passe par la clé service.
 */
import { getRepo } from "../../data";
import type { NotificationInput } from "../../data/repo";
import { isRealMode } from "../../env";
import { planNotificationEmails, type ChannelPref, type ChannelRecipient } from "./channel";
import { sendTemplates } from "./service";

async function loadRecipients(ids: string[]): Promise<{ recipients: Map<string, ChannelRecipient>; prefs: ChannelPref[] }> {
  const recipients = new Map<string, ChannelRecipient>();
  const prefs: ChannelPref[] = [];
  if (isRealMode() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { supabaseAdmin } = await import("../../supabase/server");
    const c = supabaseAdmin();
    const [{ data: people }, { data: muted }] = await Promise.all([
      c.from("profiles").select("id, email, first_name").in("id", ids),
      c.from("notification_prefs").select("profile_id, type, email").in("profile_id", ids).eq("email", false),
    ]);
    for (const p of (people ?? []) as Array<{ id: string; email: string | null; first_name: string | null }>) recipients.set(p.id, { email: p.email, firstName: p.first_name ?? "" });
    for (const m of (muted ?? []) as Array<{ profile_id: string; type: string; email: boolean }>) prefs.push({ profileId: m.profile_id, type: m.type, email: m.email });
    return { recipients, prefs };
  }
  // démo, ou mode réel sans clé service (seul son propre profil est lisible)
  const repo = getRepo();
  for (const id of ids) {
    const p = await repo.getProfile(id).catch(() => null);
    if (!p) continue;
    recipients.set(id, { email: p.email, firstName: p.firstName });
    const own = await repo.listNotificationPrefs(id).catch(() => []);
    for (const x of own) prefs.push({ profileId: x.profileId, type: x.type, email: x.email });
  }
  return { recipients, prefs };
}

export async function deliverNotificationEmails(rows: NotificationInput[], extras?: ReadonlyArray<Record<string, unknown> | undefined>): Promise<number> {
  if (!rows.length) return 0;
  try {
    const ids = [...new Set(rows.map((r) => r.recipientId))];
    const ctx = await loadRecipients(ids);
    const planned = planNotificationEmails(rows, { ...ctx, extras });
    const results = await sendTemplates(planned.map((p) => ({ message: { template: p.template, to: p.to, data: p.data }, opts: { profileId: p.profileId, essential: p.essential || undefined } })));
    return results.filter((r) => r.ok).length;
  } catch (e) {
    console.error("[e-mails] notifications :", e instanceof Error ? e.message : e);
    return 0;
  }
}
