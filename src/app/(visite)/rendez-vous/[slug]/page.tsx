import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetail } from "@/components/events/EventDetail";
import { getViewer } from "@/lib/auth";
import { getRepo } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ev = await getRepo().getEventBySlug((await params).slug);
  return { title: ev && ev.status === "published" ? ev.title : "Rendez-vous" };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const ev = await getRepo().getEventBySlug(slug);
  if (!ev || ev.status !== "published") notFound();
  const viewer = await getViewer();
  return <EventDetail ev={ev} ctx="visit" viewer={viewer} backHref="/rendez-vous" />;
}
