import { ColumnsSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Mes paiements. */
export default function Loading() {
  return <ColumnsSkeleton wide left={[3, 4]} right={[3, 1]} head={{ eyebrow: "Moi", deskOnly: true, title: "Mes paiements", sub: 0 }} />;
}
