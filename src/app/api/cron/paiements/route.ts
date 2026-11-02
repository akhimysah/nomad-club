import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getRepo } from "@/lib/data";
import { runDailyPayments } from "@/lib/modules/paiements/cron";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest, secret: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Vague 2 · paiements — tâche quotidienne : échéances en retard, relances, suspension après le délai de
 * grâce, rappels de renouvellement J-30 / J-7 / J-1, statuts du carnet pro. Protégée par CRON_SECRET.
 * En mode réel, nécessite SUPABASE_SERVICE_ROLE_KEY.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET n’est pas configuré." }, { status: 503 });
  if (!authorized(req, secret)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const run = await runDailyPayments();
    const total = run.suspended + run.reinstated + run.overdueReminders + run.renewalReminders + run.simulatedCharges;
    if (total)
      await getRepo().payAudit({
        actorId: null, action: "reminder.send", targetType: "reminder", targetId: null,
        summary: `Paiements (tâche du jour) : ${run.overdueReminders} relance(s) d’échéance, ${run.renewalReminders} rappel(s) de renouvellement, ${run.suspended} suspension(s)`,
        details: run,
      });
    return NextResponse.json({ ok: true, ...run });
  } catch (e) {
    console.error("[cron paiements]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Échec de la tâche des paiements." }, { status: 500 });
  }
}
