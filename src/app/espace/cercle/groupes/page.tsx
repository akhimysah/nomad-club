import { redirect } from "next/navigation";

/** Lot 1 — La liste des groupes est un onglet du Cercle. */
export default function GroupsIndex() {
  redirect("/espace/cercle?onglet=groupes");
}
