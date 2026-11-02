import { serveContractPdf } from "@/lib/modules/contrats/service";

export const dynamic = "force-dynamic";

/** Vague 2 · Contrats — PDF d'un contrat pour les fondatrices (ou certificat avec ?certificat=1). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return serveContractPdf(id, { certificate: new URL(req.url).searchParams.get("certificat") === "1" });
}
