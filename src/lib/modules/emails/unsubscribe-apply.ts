/**
 * Désinscription (serveur) : coupe la préférence « e-mail » d'un type de notification à partir d'un jeton signé.
 * Pas de session nécessaire (lien ouvert depuis la messagerie) : en mode réel, écriture par la clé service.
 */
import { getRepo } from "../../data";
import { isRealMode } from "../../env";
import { NOTIFICATION_LABEL } from "../../notify";
import type { NotificationType } from "../../types";
import { unsubscribeSecret } from "./config";
import { verifyUnsubscribe } from "./unsubscribe";

export type UnsubscribeTarget = { profileId: string; type: NotificationType; label: string };

export function readUnsubscribeToken(token: string | null | undefined): UnsubscribeTarget | null {
  const v = verifyUnsubscribe(token, unsubscribeSecret());
  // « apercu » : jeton des aperçus de /fondatrices/emails (aucun compte derrière)
  if (!v || v.profileId === "apercu" || !(v.type in NOTIFICATION_LABEL)) return null;
  const type = v.type as NotificationType;
  return { profileId: v.profileId, type, label: NOTIFICATION_LABEL[type].label };
}

export async function applyUnsubscribe(token: string | null | undefined): Promise<UnsubscribeTarget | null> {
  const t = readUnsubscribeToken(token);
  if (!t) return null;
  try {
    if (isRealMode()) {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
      const { supabaseAdmin } = await import("../../supabase/server");
      const { error } = await supabaseAdmin()
        .from("notification_prefs")
        .upsert({ profile_id: t.profileId, type: t.type, email: false, updated_at: new Date().toISOString() }, { onConflict: "profile_id,type" });
      if (error) throw new Error(error.message);
    } else {
      await getRepo().setNotificationPref(t.profileId, t.type, "email", false);
    }
    return t;
  } catch (e) {
    console.error("[e-mails] désinscription :", e instanceof Error ? e.message : e);
    return null;
  }
}
