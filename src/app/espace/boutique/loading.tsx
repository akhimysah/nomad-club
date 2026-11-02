import { GridSkeleton, SHOP_TABS } from "@/components/ui/Skeleton";

/** Écran de chargement : Boutique. */
export default function Loading() {
  return <GridSkeleton variant="shop" chipTabs={{ items: SHOP_TABS, on: 0 }} head={{ eyebrow: "Ressources digitales", title: "La boutique du club" }} />;
}
