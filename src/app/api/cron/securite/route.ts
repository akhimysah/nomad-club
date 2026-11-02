import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isRealMode } from "@/lib/env";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 16) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Lot 6 — tâche planifiée quotidienne (Vercel Cron : en-tête « Authorization: Bearer CRON_SECRET »).
 * Ménage des compteurs de limitation de fréquence et nombre de demandes de suppression dont le délai de grâce est écoulé
 * (le traitement reste une décision des administratrices, dans /fondatrices/securite).
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (!isRealMode() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: true, skipped: "mode démo ou clé service absente" });
  const { supabaseAdmin } = await import("@/lib/supabase/server");
  const admin = supabaseAdmin();
  const [purged, due] = await Promise.all([
    admin.rpc("purge_rate_limits"),
    admin.from("deletion_requests").select("id", { count: "exact", head: true }).eq("status", "pending").lte("scheduled_for", new Date().toISOString()),
  ]);
  return NextResponse.json({ ok: !purged.error && !due.error, rateLimitsPurged: purged.data ?? 0, deletionRequestsDue: due.count ?? 0 });
}
