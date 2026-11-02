import { serveContractPdf } from "@/lib/modules/contrats/service";

export const dynamic = "force-dynamic";

/** Vague 2 · Contrats — PDF du contrat (ou certificat d'acceptation avec ?certificat=1), après vérification des droits. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return serveContractPdf(id, { certificate: new URL(req.url).searchParams.get("certificat") === "1" });
}
