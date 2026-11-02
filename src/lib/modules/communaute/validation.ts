/** Lot 1 — Communauté : validation des formulaires (zod). */
import { z } from "zod";
import { isAcceptableImage, parseSkills } from "./domain";
import { GROUP_ICONS, REACTION_KINDS } from "./types";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au plus.`)
    .transform((s) => (s ? s : null))
    .nullable()
    .optional()
    .transform((s) => s ?? null);

export const newsSchema = z.object({
  title: z.string().trim().min(2, "Donnez un titre à la publication.").max(140),
  body: z.string().trim().min(1, "Écrivez quelques lignes.").max(10000),
  image: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((s) => s || null)
    .refine((s) => s === null || isAcceptableImage(s), "Image non acceptée (photo du club, image JPEG/PNG de 1 Mo au plus)."),
  pinned: z.boolean().default(false),
  commentsEnabled: z.boolean().default(false),
});
export type NewsForm = z.input<typeof newsSchema>;

export const commentSchema = z.string().trim().min(1, "Écris quelques mots.").max(1000, "1000 caractères au plus.");

export const reactionSchema = z.enum(REACTION_KINDS);

export const groupSchema = z.object({
  name: z.string().trim().min(2, "Donnez un nom au groupe.").max(80),
  description: z.string().trim().max(400).default(""),
  icon: z.enum(GROUP_ICONS),
  joinPolicy: z.enum(["open", "request"]),
  listed: z.boolean().default(true),
});
export type GroupForm = z.input<typeof groupSchema>;

export const keywordSchema = z.object({
  keyword: z.string().trim().min(2, "Au moins 2 caractères.").max(60),
  action: z.enum(["hide", "flag"]),
});

export const reportSchema = z.string().trim().min(2, "Dis-nous en un mot pourquoi.").max(300);

const url = (max: number) => optText(max).refine((s) => s === null || !/[<>"\s]/.test(s), "Adresse invalide.");

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Ton prénom.").max(40),
  lastName: z.string().trim().max(60).default(""),
  job: optText(120),
  country: optText(80),
  marrakechSince: optText(30),
  bio: optText(600),
  whatsapp: optText(30).refine((s) => s === null || s.replace(/\D/g, "").length >= 8, "Un numéro WhatsApp complet, avec l’indicatif."),
  avatarUrl: z
    .string()
    .optional()
    .nullable()
    .transform((s) => s || null)
    .refine((s) => s === null || isAcceptableImage(s), "Photo non acceptée (JPEG ou PNG, 1 Mo au plus)."),
  company: optText(120),
  sector: optText(80),
  skills: z
    .union([z.string(), z.array(z.string())])
    .default("")
    .transform((v) => parseSkills(Array.isArray(v) ? v.join(",") : v)),
  instagram: url(200),
  linkedin: url(200),
  website: url(200),
  lookingFor: optText(500),
  offering: optText(500),
  visibility: z.enum(["all", "basic", "hidden"]),
  showWhatsapp: z.boolean().default(false),
  showEmail: z.boolean().default(false),
});
export type ProfileForm = z.input<typeof profileSchema>;
