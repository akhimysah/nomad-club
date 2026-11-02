/**
 * Types du CRM (Lot 5). Ils reflètent supabase/migrations/0007_crm.sql en camelCase.
 * Ce fichier ne contient que des types et des constantes : il est importable partout
 * (pages, composants client, script de génération de seed.sql).
 */
import type { Payment, Profile } from "../../types.ts";

export type ContactKind = "person" | "organization";

export const CONTACT_SOURCES = ["instagram", "bouche_a_oreille", "evenement", "site", "parrainage", "partenaire", "presse", "linkedin", "import", "appli", "autre"] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

export const SOURCE_LABEL: Record<ContactSource, string> = {
  instagram: "Instagram",
  bouche_a_oreille: "Bouche-à-oreille",
  evenement: "Événement",
  site: "Site",
  parrainage: "Parrainage",
  partenaire: "Partenaire",
  presse: "Presse",
  linkedin: "LinkedIn",
  import: "Import",
  appli: "Inscription appli",
  autre: "Autre",
};

export const CONTACT_STATUSES = ["prospect", "adherente", "ancienne", "partenaire", "pro", "presse", "equipe", "autre"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const STATUS_LABEL: Record<ContactStatus, string> = {
  prospect: "Prospect",
  adherente: "Adhérente",
  ancienne: "Ancienne membre",
  partenaire: "Partenaire",
  pro: "Pro",
  presse: "Presse",
  equipe: "Équipe",
  autre: "Autre",
};

/** Fiche contact enregistrée (table crm_contacts). */
export type Contact = {
  id: string;
  kind: ContactKind;
  /** Compte de l'appli relié (une fiche par compte). */
  profileId: string | null;
  organizationId: string | null;
  firstName: string;
  lastName: string;
  company: string | null;
  job: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  city: string | null;
  source: ContactSource;
  /** Statut saisi. Pour une fiche reliée à un compte, le statut affiché est recalculé (voir effectiveStatus). */
  status: ContactStatus;
  tags: string[];
  notes: string;
  marketingConsent: boolean;
  consentAt: string | null;
  ownerId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StageOutcome = "open" | "won" | "lost";

export type Stage = { id: string; label: string; position: number; outcome: StageOutcome };

/** Opportunité du pipeline (une carte du kanban). */
export type Deal = {
  id: string;
  contactId: string;
  stageId: string;
  title: string;
  value: number;
  lostReason: string | null;
  ownerId: string | null;
  position: number;
  expectedClose: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ACTIVITY_TYPES = ["call", "whatsapp", "email", "meeting", "note", "event", "system"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: "Appel",
  whatsapp: "WhatsApp",
  email: "E-mail",
  meeting: "Rendez-vous",
  note: "Note",
  event: "Venue à un événement",
  system: "Système",
};

export type Activity = {
  id: string;
  contactId: string;
  type: ActivityType;
  body: string;
  occurredAt: string;
  authorId: string | null;
  createdAt: string;
};

export type Task = {
  id: string;
  contactId: string | null;
  title: string;
  /** Échéance (AAAA-MM-JJ). */
  dueOn: string;
  ownerId: string | null;
  doneAt: string | null;
  remindedAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

/**
 * Filtres combinables du CRM (liste des contacts, segments enregistrés).
 * Tous facultatifs ; ils se cumulent (ET).
 */
export type ContactFilter = {
  q?: string;
  status?: ContactStatus[];
  source?: ContactSource[];
  tags?: string[];
  /** Responsable (identifiant de profil) ou « none » (sans responsable). */
  owner?: string;
  consent?: boolean;
  hasAccount?: boolean;
  /** Étape du pipeline (identifiant). */
  stage?: string;
  /** Adhésion en cours qui expire dans N jours au plus. */
  expiresWithin?: number;
  /** Ancienne membre dont l'adhésion s'est terminée cette année-là. */
  lapsedYear?: number;
  /** Venue à au moins un événement sans être adhérente. */
  eventNoMembership?: boolean;
  /** Aucun échange depuis N jours. */
  quietDays?: number;
};

export type Segment = {
  id: string;
  name: string;
  description: string | null;
  filters: ContactFilter;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Toutes les données du CRM (petit volume : chargées d'un bloc, filtrées en mémoire). */
export type CrmData = {
  contacts: Contact[];
  stages: Stage[];
  deals: Deal[];
  activities: Activity[];
  tasks: Task[];
  segments: Segment[];
};

/** Ligne enrichie pour les listes : la fiche + le compte relié + ce qu'on sait d'elle dans l'appli. */
export type ContactRow = {
  contact: Contact;
  profile: Profile | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: ContactStatus;
  /** Fin de l'adhésion (compte relié). */
  planEndsAt: string | null;
  plan: Profile["plan"] | null;
  /** Rendez-vous réservés (non annulés) + activités « événement ». */
  events: number;
  lastActivityAt: string | null;
  openTasks: number;
  deal: Deal | null;
  stage: Stage | null;
  organizationName: string | null;
};

export type CrmAuditAction =
  | "crm.contact_create"
  | "crm.contact_update"
  | "crm.contact_merge"
  | "crm.contact_import"
  | "crm.contact_export"
  | "crm.bulk_update"
  | "crm.deal_save"
  | "crm.deal_move"
  | "crm.task_create"
  | "crm.segment_save"
  | "crm.segment_delete"
  | "crm.stages_update";

export const CRM_AUDIT_LABEL: Record<CrmAuditAction, string> = {
  "crm.contact_create": "Contact créé",
  "crm.contact_update": "Contact modifié",
  "crm.contact_merge": "Contacts fusionnés",
  "crm.contact_import": "Import de contacts",
  "crm.contact_export": "Export de contacts",
  "crm.bulk_update": "Action groupée",
  "crm.deal_save": "Opportunité",
  "crm.deal_move": "Étape du pipeline",
  "crm.task_create": "Tâche créée",
  "crm.segment_save": "Segment enregistré",
  "crm.segment_delete": "Segment supprimé",
  "crm.stages_update": "Étapes du pipeline",
};

export type CrmTargetType = "crm_contact" | "crm_deal" | "crm_task" | "crm_segment";

/** Retombées commerciales des deals déclarés par les membres (Espace Business, Lot 4). */
export type DealOutcome = {
  id: string;
  /** Mois (AAAA-MM). */
  month: string;
  amount: number;
  sector: string;
  /** Personnes concernées (profils), si connues. */
  profileIds: string[];
};

export type DealOutcomeSource = { available: boolean; sample: boolean; rows: DealOutcome[] };

/** Historique commercial d'une fiche reliée à un compte (onglet Adhésion). */
export type ContactMembership = {
  plan: Profile["plan"];
  planEndsAt: string | null;
  payments: Payment[];
};
