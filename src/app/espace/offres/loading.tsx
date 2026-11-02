import { CARNET_TABS, GridSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Offres partenaires. */
export default function Loading() {
  return (
    <GridSkeleton
      variant="offer"
      tabs={{ items: CARNET_TABS, on: 1 }}
      search
      chips={5}
      head={{
        eyebrow: "Offres partenaires",
        deskOnly: true,
        title: "Les avantages du club",
      }}
    />
  );
}
