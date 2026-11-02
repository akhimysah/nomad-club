import { GridSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Agenda. */
export default function Loading() {
  return (
    <GridSkeleton
      variant="ev"
      count={4}
      head={{
        eyebrow: "Agenda",
        deskOnly: true,
        title: "Les prochains rendez-vous",
        actions: [92, 128],
      }}
    />
  );
}
