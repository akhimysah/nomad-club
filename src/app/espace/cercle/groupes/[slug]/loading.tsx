import { ChatSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Fil d’un groupe. */
export default function Loading() {
  return <ChatSkeleton variant="thread" />;
}
