import type { Metadata } from "next";
import { Assistant } from "@/components/member/Assistant";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AssistantPage({ searchParams }: Props) {
  const v = await requireMember();
  const { q } = await searchParams;
  return (
    <Screen group="member" index={4} className="mscreen chat on">
      <Assistant firstName={v.profile.firstName} initialQuestion={q ? q.slice(0, 300) : null} demo={v.mode === "demo"} />
    </Screen>
  );
}
