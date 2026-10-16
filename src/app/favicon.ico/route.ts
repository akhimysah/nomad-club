import { NextResponse, type NextRequest } from "next/server";

/** Les navigateurs demandent /favicon.ico d'office : on renvoie vers l'icône de l'appli. */
export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/icons/icon-192.png", req.url), 308);
}
