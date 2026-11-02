import { ListSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Modération. */
export default function Loading() {
  return <ListSkeleton cards={[5]} head={{ eyebrow: "Modération", title: "Veiller sur le cercle" }} />;
}
