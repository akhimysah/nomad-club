/**
 * Journal des opérations importantes (table audit_log).
 * Un échec de journalisation ne bloque pas l'opération, mais il est signalé dans les logs serveur.
 */
import { getRepo } from "./data";
import type { AuditInput } from "./data/repo";

export async function audit(entry: AuditInput): Promise<void> {
  try {
    await getRepo().logAudit(entry);
  } catch (e) {
    console.error("[audit]", entry.action, e instanceof Error ? e.message : e);
  }
}
