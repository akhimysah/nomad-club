import { ColumnsSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Ma fiche. */
export default function Loading() {
  return <ColumnsSkeleton left={[6]} right={[4]} head={{ eyebrow: "Moi", title: "Ma fiche", actions: [150] }} />;
}
