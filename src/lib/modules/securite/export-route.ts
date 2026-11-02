/** Lot 6 — réponse HTTP de l'export RGPD (partagée par /espace/moi/donnees/export et /api/moi/export). */
import { NextResponse } from "next/server";
import { audit } from "../../audit";
import { getViewer } from "../../auth";
import { today } from "../../clock";
import { fullName } from "../../format";
import { buildPersonalExport } from "./export";
import { rateLimit } from "./rate-limit";

export async function personalExportResponse(): Promise<NextResponse> {
  const v = await getViewer();
  if (!v.profile) return NextResponse.json({ error: "Connecte-toi d’abord." }, { status: 401 });
  const limit = await rateLimit("dataExport", `user:${v.profile.id}`);
  if (!limit.ok) return NextResponse.json({ error: limit.message }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const data = await buildPersonalExport(v.profile);
  await audit({
    actorId: v.profile.id,
    action: "data.export",
    targetType: "profile",
    targetId: v.profile.id,
    summary: `${fullName(v.profile)} a téléchargé ses données`,
  });
  // --- E-mails --- avis de sécurité : un export de données a été fait sur ce compte
  await (await import("../emails/triggers")).sendDataExportReady(v.profile);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mes-donnees-nomad-club-${today()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
