import { ListSkeleton, SHOP_TABS } from "@/components/ui/Skeleton";

/** Écran de chargement : Mes ressources. */
export default function Loading() {
  return (
    <ListSkeleton
      cards={[4]}
      chipTabs={{ items: SHOP_TABS, on: 1 }}
      head={{
        eyebrow: "Ressources digitales",
        title: "Mes ressources",
        sub: 0,
      }}
    />
  );
}
