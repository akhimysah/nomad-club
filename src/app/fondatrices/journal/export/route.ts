import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { checkCapability } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { fullName } from "@/lib/format";
import { auditCsv, parseAuditFilters } from "@/lib/modules/securite/audit-view";

export const dynamic = "force-dynamic";

/** Lot 6 — export CSV du journal (mêmes filtres que la page), réservé aux administratrices. L'export est journalisé. */
export async function GET(req: NextRequest) {
  const a = await checkCapability("audit.export");
  if (!a) return NextResponse.json({ error: "Réservé aux administratrices." }, { status: 403 });
  const filters = parseAuditFilters(Object.fromEntries(req.nextUrl.searchParams));
  const repo = getRepo();
  const [entries, profiles] = await Promise.all([repo.searchAudit({ ...filters, limit: 5000 }), repo.listProfiles()]);
  await audit({
    actorId: a.profile.id,
    action: "audit.export",
    targetType: "profile",
    targetId: a.profile.id,
    summary: `Journal exporté par ${fullName(a.profile)} (${entries.length} lignes)`,
    details: { filters },
  });
  const csv = auditCsv(entries, new Map(profiles.map((p) => [p.id, fullName(p)])));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="journal-nomad-club-${today()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
