/**
 * Accès aux données du module paiements (méthodes préfixées `pay*`), étendu par l'interface `Repo`.
 * Implémentations : memory-repo.ts (démo et tests) et supabase-repo.ts (mode réel : écritures par la clé
 * service, lectures des pages sous RLS).
 *
 * Idempotence : `payRecordEvent`, `payRecordTransaction` et `payRecordRefund` ne créent jamais deux lignes
 * pour la même référence ; `payUpdateInstallment` peut être conditionné au statut courant.
 */
import type { AuditInput } from "../../data/repo";
import type { Profile, Reminder } from "../../types";
import type {
  Checkout,
  CheckoutPatch,
  Contact,
  ProSubscriptionLite,
  EventStatus,
  Installment,
  InstallmentPatch,
  InstallmentPlan,
  NewCheckout,
  NewInstallment,
  NewPlan,
  NewRefund,
  NewTransaction,
  Owner,
  PlanPatch,
  PlanStatus,
  ProviderId,
  Refund,
  StoredEvent,
  Transaction,
  TransactionStatus,
} from "./types";

export interface PaiementsRepo {
  /* sessions de paiement */
  payCreateCheckout(input: NewCheckout): Promise<Checkout>;
  payGetCheckout(id: string): Promise<Checkout | null>;
  payFindCheckout(by: { providerRef?: string; subscriptionRef?: string }): Promise<Checkout | null>;
  payUpdateCheckout(id: string, patch: CheckoutPatch): Promise<void>;

  /* événements des prestataires */
  /** Enregistre l'événement s'il est nouveau ; sinon renvoie l'existant (fresh = false). Incrémente les tentatives. */
  payRecordEvent(input: { provider: ProviderId; eventId: string; type: string; payload: unknown }): Promise<{ fresh: boolean; event: StoredEvent }>;
  payFinishEvent(provider: ProviderId, eventId: string, status: Exclude<EventStatus, "received">, error?: string | null): Promise<void>;
  payGetEvent(provider: ProviderId, eventId: string): Promise<StoredEvent | null>;
  payListEvents(opts?: { status?: EventStatus; limit?: number }): Promise<StoredEvent[]>;

  /* clients chez le prestataire */
  payGetCustomer(provider: ProviderId, owner: Owner): Promise<string | null>;
  paySetCustomer(provider: ProviderId, owner: Owner, customerRef: string): Promise<void>;

  /* échéanciers */
  payCreatePlan(input: NewPlan, installments: NewInstallment[]): Promise<InstallmentPlan>;
  payGetPlan(id: string): Promise<InstallmentPlan | null>;
  payFindPlan(by: { subscriptionRef?: string; paymentId?: string }): Promise<InstallmentPlan | null>;
  payUpdatePlan(id: string, patch: PlanPatch): Promise<void>;
  /** Renvoie false si l'échéance n'est pas dans l'un des statuts attendus (déjà traitée). */
  payUpdateInstallment(id: string, patch: InstallmentPatch, onlyIfStatus?: Installment["status"][]): Promise<boolean>;
  /** system = lecture serveur sans session (tâche planifiée, webhook). */
  payListPlans(opts?: { profileId?: string; statuses?: PlanStatus[]; system?: boolean }): Promise<InstallmentPlan[]>;

  /* grand livre */
  payRecordTransaction(input: NewTransaction): Promise<{ transaction: Transaction; fresh: boolean }>;
  payFindTransaction(by: { id?: string; providerRef?: string; chargeRef?: string; system?: boolean }): Promise<Transaction | null>;
  payUpdateTransaction(id: string, patch: { amountRefunded: number; status: TransactionStatus }): Promise<void>;
  payListTransactions(opts?: { profileId?: string; organizationId?: string; limit?: number }): Promise<Transaction[]>;
  payRecordRefund(input: NewRefund): Promise<{ refund: Refund; fresh: boolean }>;
  payListRefunds(opts?: { limit?: number }): Promise<Refund[]>;

  /* accès membre (impayé) */
  /** Retire ou rend le rôle « member » (jamais pour une administratrice). */
  paySetMemberAccess(profileId: string, active: boolean): Promise<boolean>;

  /* relances de renouvellement (table reminders) */
  /** Adhérentes dont l'adhésion se termine entre deux dates (incluses). Lecture serveur. */
  payRenewalCandidates(fromYmd: string, toYmd: string): Promise<Profile[]>;
  /** Relances de renouvellement programmées, non envoyées, prévues au plus tard aujourd'hui. */
  payDueReminders(todayYmd: string): Promise<Reminder[]>;
  /** Programme une relance (renouvellement) si elle n'existe pas déjà pour cette échéance et ce jour. */
  payScheduleReminder(input: { profileId: string; dueAt: string; scheduledFor: string }): Promise<boolean>;
  payMarkReminderSent(id: string): Promise<void>;

  /* lectures serveur (webhook, tâche planifiée : pas de session) */
  payContact(profileId: string): Promise<Contact | null>;
  /** Équipe d'un établissement (propriétaire en premier). */
  payOrgContacts(organizationId: string): Promise<Contact[]>;
  payProSubscription(organizationId: string): Promise<ProSubscriptionLite | null>;

  /** Journal des opérations faites par le système (webhook, tâche planifiée), sans session. */
  payAudit(entry: AuditInput): Promise<void>;
}
