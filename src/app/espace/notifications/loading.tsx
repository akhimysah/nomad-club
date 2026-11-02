import { ListSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Notifications. */
export default function Loading() {
  return <ListSkeleton cards={[4, 5]} head={{ eyebrow: "Ton activité", deskOnly: true, title: "Notifications" }} />;
}
