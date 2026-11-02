import { ColumnsSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Moi. */
export default function Loading() {
  return (
    <ColumnsSkeleton
      member
      left={[]}
      right={[4, 5, 2, 4]}
      head={{
        eyebrow: "Moi",
        deskOnly: true,
        title: "Ma carte et mon adhésion",
        sub: 0,
        actions: [96, 110, 140],
      }}
    />
  );
}
