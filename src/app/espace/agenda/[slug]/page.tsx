import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetail } from "@/components/events/EventDetail";
import { requireMember } from "@/lib/auth";
import { getRepo } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ev = await getRepo().getEventBySlug((await params).slug);
  return { title: ev?.title ?? "Rendez-vous" };
}

export default async function MemberEventPage({ params }: Props) {
  const v = await requireMember();
  const ev = await getRepo().getEventBySlug((await params).slug);
  if (!ev || ev.status !== "published") notFound();
  return <EventDetail ev={ev} ctx="member" viewer={v} backHref="/espace/agenda" />;
}
