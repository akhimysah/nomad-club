import { redirect } from "next/navigation";

/** Lot 1 — La section Communauté s'ouvre sur les actualités. */
export default function CommunauteIndex() {
  redirect("/fondatrices/communaute/actualites");
}
