import type { Metadata } from "next";
import { OrgSheet } from "@/components/org/OrgPages";

export const metadata: Metadata = { title: "Ma fiche" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ id?: string }> };

export default async function Page({ searchParams }: Props) {
  const { id } = await searchParams;
  return <OrgSheet kind="pro" id={id} />;
}
