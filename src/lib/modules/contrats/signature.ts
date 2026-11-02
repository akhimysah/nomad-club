/**
 * Vague 2 · Contrats — fournisseurs de signature.
 *
 * Aujourd'hui : `simple` (acceptation électronique simple : case à cocher, horodatage, IP, navigateur,
 * version du modèle, empreinte SHA-256 du PDF), enregistrée par la fonction SQL accept_contract().
 *
 * Plus tard : un prestataire de signature électronique avancée ou qualifiée (Yousign, Docusign) se branche
 * ici sans toucher aux écrans : `start()` renvoie alors une adresse de signature (redirection), et le webhook
 * du prestataire appelle `repo.acceptContract({ provider: "yousign", providerRef, ... })` avec la clé service.
 * Choix par la variable CONTRACT_SIGNATURE_PROVIDER (simple par défaut).
 */
import { getRepo } from "../../data";
import type { AcceptInput, ContractAcceptance, ContractView } from "./types";

export type SignatureStart =
  /** Acceptation dans l'appli (case à cocher) : l'écran affiche le contrat et la case. */
  | { mode: "inline" }
  /** Prestataire externe : rediriger la signataire vers cette adresse. */
  | { mode: "redirect"; url: string };

export interface SignatureProvider {
  readonly id: string;
  readonly label: string;
  /** Prépare la signature d'un contrat en attente. */
  start(contract: ContractView): Promise<SignatureStart>;
  /** Enregistre l'acceptation (mode inline). */
  accept(input: Omit<AcceptInput, "provider" | "providerRef">): Promise<ContractAcceptance>;
}

export const simpleSignature: SignatureProvider = {
  id: "simple",
  label: "Acceptation électronique simple",
  async start() {
    return { mode: "inline" };
  },
  async accept(input) {
    return getRepo().acceptContract({ ...input, provider: "simple", providerRef: null });
  },
};

/**
 * Emplacement prévu pour Yousign (API v3 : créer une « signature request », ajouter le PDF et la signataire,
 * activer, rediriger ; webhook `signature_request.done` → acceptContract avec provider = "yousign").
 * Non branché : il faut un compte, une clé YOUSIGN_API_KEY et la décision de la cliente (voir docs/contrats/README.md).
 */
export const yousignSignature: SignatureProvider = {
  id: "yousign",
  label: "Signature électronique Yousign",
  async start() {
    throw new Error("Signature Yousign non configurée (YOUSIGN_API_KEY manquante).");
  },
  async accept() {
    throw new Error("Avec Yousign, l'acceptation arrive par le webhook du prestataire.");
  },
};

export function getSignatureProvider(): SignatureProvider {
  const id = process.env.CONTRACT_SIGNATURE_PROVIDER ?? "simple";
  if (id === "yousign" && process.env.YOUSIGN_API_KEY) return yousignSignature;
  return simpleSignature;
}
