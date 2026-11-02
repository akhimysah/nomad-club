import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cercle } from "@/components/member/Cercle";
import { Screen } from "@/components/ui/Screen";
import { requireMember, viewerCan } from "@/lib/auth";
import { loadCercle } from "@/lib/cercle";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ThreadPage({ params }: Props) {
  const v = await requireMember();
  const { id } = await params;
  const data = await loadCercle(v.profile, decodeURIComponent(id));
  if (!data) notFound();
  return (
    <Screen group="member" index={2} className="mscreen chat on">
      <Cercle key={id} tab="messages" demo={v.mode === "demo"} canModerate={viewerCan(v, "messages.moderate")} {...data} />
    </Screen>
  );
}
