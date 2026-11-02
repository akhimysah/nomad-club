import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { purgeEmailLog, sendRenewalReminders } from "@/lib/modules/emails/triggers";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest, secret: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * E-mails — tâche quotidienne (vercel.json) : rappels de renouvellement J-30, J-7 et J-1 (une fois par échéance),
 * puis purge du journal des envois de plus de 180 jours. Protégée par CRON_SECRET ; en mode réel, nécessite
 * SUPABASE_SERVICE_ROLE_KEY (lecture des échéances de toutes les membres).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET n’est pas configuré." }, { status: 503 });
  if (!authorized(req, secret)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    // Les rappels de renouvellement sont envoyés par /api/cron/paiements (il connaît les échéanciers).
    // Ils ne partent d'ici que si ce dernier les a coupés (PAYMENT_RENEWAL_REMINDERS=false) : jamais deux fois.
    const renewals = process.env.PAYMENT_RENEWAL_REMINDERS === "false" ? await sendRenewalReminders() : 0;
    const purged = await purgeEmailLog().catch((e) => {
      console.error("[cron e-mails] purge :", e instanceof Error ? e.message : e);
      return 0;
    });
    return NextResponse.json({ ok: true, renewals, purged });
  } catch (e) {
    console.error("[cron e-mails]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Échec de la tâche des e-mails." }, { status: 500 });
  }
}
