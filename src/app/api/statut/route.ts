import { NextResponse } from "next/server";
import { serviceStatus } from "@/lib/modules/lancement/status";

export const dynamic = "force-dynamic";

/** Vague 2 — état du service en JSON (surveillance externe : 200 si tout va bien, 503 sinon). */
export async function GET() {
  const s = await serviceStatus();
  return NextResponse.json(s, { status: s.ok ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
