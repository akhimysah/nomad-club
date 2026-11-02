import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { audit } from "@/lib/audit";
import { sendEventReminders } from "@/lib/modules/communaute/service";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest, secret: string): boolean {
  // Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> »
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Lot 1 — Rappels J-1 : prévient les inscrites des rendez-vous de demain (une fois par personne).
 * Appelé chaque jour par le cron Vercel (vercel.json). Protégé par le secret CRON_SECRET.
 * En mode réel, nécessite SUPABASE_SERVICE_ROLE_KEY (lecture des réservations, notifications des autres).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET n’est pas configuré." }, { status: 503 });
  if (!authorized(req, secret)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const run = await sendEventReminders();
    if (run.total)
      await audit({
        actorId: null,
        action: "event.remind",
        targetType: "event",
        targetId: null,
        summary: `Rappels J-1 automatiques : ${run.total} inscrite${run.total > 1 ? "s" : ""}`,
        details: { day: run.day, events: run.events },
      });
    return NextResponse.json({ ok: true, ...run });
  } catch (e) {
    console.error("[cron rappels]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Échec de l’envoi des rappels." }, { status: 500 });
  }
}
