import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/public-url";

/** Les navigateurs demandent /favicon.ico d'office : on renvoie vers l'icône de l'appli. */
export function GET(req: NextRequest) {
  return NextResponse.redirect(publicUrl(req, "/icons/icon-192.png"), 308);
}
