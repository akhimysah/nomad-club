import { ChatSkeleton } from "@/components/ui/Skeleton";

/** Écran de chargement : Cercle (salon). */
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
