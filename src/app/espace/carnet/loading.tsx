import { CARNET_TABS, GridSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Carnet d’adresses. */
export default function Loading() {
  return (
    <GridSkeleton
      variant="place"
      tabs={{ items: CARNET_TABS, on: 0 }}
      search
      chips={8}
      head={{
        eyebrow: "Carnet d’adresses",
        deskOnly: true,
        title: "Le carnet du club",
      }}
    />
  );
}
