/**
 * Accès aux données du CRM (Lot 5). L'interface `Repo` (src/lib/data/repo.ts) l'étend ;
 * implémentations : demo-repo.ts (mémoire) et supabase-repo.ts (Postgres, RLS administratrices).
 * Les méthodes sont préfixées « crm » pour ne jamais entrer en collision avec les autres lots.
 */
import type { ActivityType, Contact, ContactFilter, ContactKind, ContactSource, ContactStatus, CrmData, Deal, Segment, Stage, StageOutcome, Task, Activity } from "./types";

export type ContactInput = {
  kind: ContactKind;
  firstName: string;
  lastName: string;
  company: string | null;
  job: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  city: string | null;
  source: ContactSource;
  status: ContactStatus;
  tags: string[];
  notes: string;
  marketingConsent: boolean;
  ownerId: string | null;
  profileId?: string | null;
};

export type DealInput = {
  contactId: string;
  stageId: string;
  title: string;
  value: number;
  ownerId: string | null;
  expectedClose: string | null;
  lostReason?: string | null;
};

export type ActivityInput = { contactId: string; type: ActivityType; body: string; occurredAt: string; authorId: string | null };

export type TaskInput = { contactId: string | null; title: string; dueOn: string; ownerId: string | null; createdBy: string | null };

export type SegmentInput = { name: string; description: string | null; filters: ContactFilter };

export type StageInput = { id: string | null; label: string; outcome: StageOutcome };

export type BulkPatch = { addTag?: string; removeTag?: string; ownerId?: string | null; consent?: boolean };

export interface CrmRepo {
  /** Toutes les données du CRM (les profils sans fiche en reçoivent une au passage). */
  crmData(): Promise<CrmData>;

  crmCreateContact(input: ContactInput, actorId: string): Promise<Contact>;
  crmUpdateContact(id: string, input: Partial<ContactInput>): Promise<Contact>;
  /** Import CSV : crée les fiches (les doublons sont écartés avant, côté application). */
  crmImportContacts(rows: ContactInput[], actorId: string): Promise<number>;
  crmBulkUpdate(ids: string[], patch: BulkPatch): Promise<number>;
  /** Verse `dropId` dans `keepId` (activités, tâches, opportunités, champs vides) puis supprime `dropId`. */
  crmMergeContacts(keepId: string, dropId: string, actorId: string): Promise<Contact>;

  crmSaveDeal(input: DealInput, id: string | null): Promise<Deal>;
  /** Change d'étape (et de place dans la colonne) ; le motif de perte est exigé par l'application pour l'étape « Perdu ». */
  crmMoveDeal(id: string, stageId: string, position: number, lostReason: string | null): Promise<Deal>;
  /** Remplace la liste des étapes (renommer, réordonner, ajouter ; une étape utilisée ne peut pas disparaître). */
  crmSaveStages(stages: StageInput[]): Promise<Stage[]>;

  crmAddActivity(input: ActivityInput): Promise<Activity>;

  crmCreateTasks(inputs: TaskInput[]): Promise<Task[]>;
  crmUpdateTask(id: string, patch: Partial<Pick<Task, "title" | "dueOn" | "ownerId">>): Promise<Task>;
  crmSetTaskDone(id: string, done: boolean): Promise<Task>;
  crmMarkTasksReminded(ids: string[]): Promise<void>;

  crmSaveSegment(input: SegmentInput, id: string | null, actorId: string): Promise<Segment>;
  crmDeleteSegment(id: string): Promise<void>;
}
