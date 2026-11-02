import type { Metadata } from "next";
import { OrgSpaceLayout } from "@/components/org/OrgSpaceLayout";

export const metadata: Metadata = { title: { default: "Espace pro", template: "%s · Espace pro" }, robots: { index: false } };

/** Espace pro : réservé aux comptes qui ont le rôle « pro » (et aux administratrices). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <OrgSpaceLayout kind="pro">{children}</OrgSpaceLayout>;
}
