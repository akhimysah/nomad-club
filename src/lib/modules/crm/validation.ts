import { z } from "zod";
import { ACTIVITY_TYPES, CONTACT_SOURCES, CONTACT_STATUSES } from "./types";
import { normalizeTag } from "./domain";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au plus.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

export const contactSchema = z
  .object({
    kind: z.enum(["person", "organization"]).default("person"),
    firstName: z.string().trim().max(80).default(""),
    lastName: z.string().trim().max(80).default(""),
    company: optText(120),
    job: optText(120),
    email: optText(160).refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Adresse e-mail invalide."),
    phone: optText(40),
    instagram: optText(60),
    city: optText(80),
    source: z.enum(CONTACT_SOURCES).default("autre"),
    status: z.enum(CONTACT_STATUSES).default("prospect"),
    tags: z.array(z.string()).max(30).default([]).transform((l) => [...new Set(l.map(normalizeTag).filter(Boolean))]),
    notes: z.string().max(8000).default(""),
    marketingConsent: z.boolean().default(false),
    ownerId: z.string().max(64).nullable().default(null),
  })
  .refine((c) => c.firstName || c.lastName || c.company, { message: "Indiquez au moins un nom ou une société.", path: ["firstName"] });

export type ContactForm = z.input<typeof contactSchema>;

export const activitySchema = z.object({
  contactId: z.string().min(1).max(64),
  type: z.enum(ACTIVITY_TYPES).refine((t) => t !== "system", "Type d’échange invalide."),
  body: z.string().trim().min(1, "Écrivez quelques mots.").max(4000),
  occurredOn: ymd.optional(),
});

export const taskSchema = z.object({
  contactId: z.string().max(64).nullable().default(null),
  title: z.string().trim().min(1, "Donnez un titre à la tâche.").max(200),
  dueOn: ymd,
  ownerId: z.string().max(64).nullable().default(null),
});

export const dealSchema = z.object({
  contactId: z.string().min(1).max(64),
  stageId: z.string().min(1).max(64),
  title: z.string().trim().min(1, "Donnez un titre à l’opportunité.").max(160),
  value: z.coerce.number().min(0, "Valeur invalide.").max(1_000_000).default(0),
  ownerId: z.string().max(64).nullable().default(null),
  expectedClose: ymd.nullable().default(null),
  lostReason: optText(300),
});

export const segmentSchema = z.object({
  name: z.string().trim().min(1, "Nommez le segment.").max(80),
  description: optText(240),
});

export const stagesSchema = z
  .array(z.object({ id: z.string().max(64).nullable(), label: z.string().trim().min(1, "Chaque étape a un nom.").max(60), outcome: z.enum(["open", "won", "lost"]) }))
  .min(2)
  .max(12)
  .refine((l) => l.some((s) => s.outcome === "won") && l.some((s) => s.outcome === "lost"), "Gardez au moins une étape « gagnée » et une étape « perdue ».");
