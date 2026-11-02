import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/engagement/admin";
import { FHead } from "@/components/founders/parts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import "@/styles/engagement.css";

export const metadata: Metadata = { title: "Nouvelle ressource" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireCapability("shop.manage", { next: "/fondatrices/boutique/nouveau" });
  return (
    <Screen group="founders" index={10} className="fscreen scroller on">
      <div className="f-inner" style={{ maxWidth: 860 }}>
        <Link className="link" href="/fondatrices/boutique">
          <Icon name="chev-l" />
          Boutique
        </Link>
        <FHead title="Nouvelle ressource" sub="Brouillon : ajoutez ensuite les fichiers, puis publiez" />
        <ProductForm product={null} />
      </div>
    </Screen>
  );
}
