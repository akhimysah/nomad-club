import { ChatSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Conversation privée. */
export default function Loading() {
  return (
    <ChatSkeleton
      head={{
        eyebrow: "Cercle",
        title: "Le salon, les groupes, l’annuaire, tes messages",
      }}
    />
  );
}
