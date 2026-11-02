import { FeedSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Actualités. */
export default function Loading() {
  return <FeedSkeleton head={{ eyebrow: "Actualités", title: "Les nouvelles du club" }} />;
}
