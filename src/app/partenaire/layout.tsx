import type { Metadata } from "next";
import { OrgSpaceLayout } from "@/components/org/OrgSpaceLayout";

export const metadata: Metadata = { title: { default: "Espace partenaire", template: "%s · Espace partenaire" }, robots: { index: false } };

/** Espace partenaire : réservé aux comptes qui ont le rôle « partner » (et aux administratrices). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <OrgSpaceLayout kind="partner">{children}</OrgSpaceLayout>;
}
