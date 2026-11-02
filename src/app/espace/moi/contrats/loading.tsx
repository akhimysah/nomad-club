import { ListSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Mes contrats. */
export default function Loading() {
  return <ListSkeleton cards={[4]} head={{ eyebrow: "Moi", title: "Mes contrats" }} />;
}
