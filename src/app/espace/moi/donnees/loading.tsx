import { ListSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Mes données. */
export default function Loading() {
  return <ListSkeleton cards={[3, 3]} avatar={false} head={{ eyebrow: "Moi", title: "Mes données" }} />;
}
