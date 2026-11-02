import { ColumnsSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Parrainage. */
export default function Loading() {
  return <ColumnsSkeleton hero left={[3]} right={[0, 3]} head={{ eyebrow: "Parrainage", title: "Fais entrer tes amies" }} />;
}
