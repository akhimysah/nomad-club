import { ColumnsSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Espace Business. */
export default function Loading() {
  return (
    <ColumnsSkeleton
      note
      left={[0, 3, 2, 3]}
      right={[8, 3]}
      head={{
        eyebrow: "Espace Business",
        title: "Les affaires entre membres",
        actions: [170],
      }}
    />
  );
}
