import { MapSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Carte. */
export default function Loading() {
  return <MapSkeleton head={{ eyebrow: "Carte", deskOnly: true, title: "Marrakech, côté club" }} />;
}
