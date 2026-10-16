import { z } from "zod";

export const firstNameSchema = z
  .string()
  .trim()
  .min(2, "Ton prénom, pour ton billet.")
  .max(40, "Un prénom un peu plus court.")
  .transform((s) => s.charAt(0).toUpperCase() + s.slice(1));

export const whatsappSchema = z
  .string()
  .trim()
  .max(30, "Un numéro WhatsApp complet, avec l’indicatif.")
  .refine((s) => s.replace(/\D/g, "").length >= 8, "Un numéro WhatsApp complet, avec l’indicatif.");

export const guestSchema = z.object({ firstName: firstNameSchema, whatsapp: whatsappSchema });

export const messageSchema = z.string().trim().min(1).max(2000);

export const eventFormSchema = z.object({
  title: z.string().trim().min(3, "Donnez un titre à l’événement.").max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choisissez une heure."),
  endTime: z.string().regex(/^(\d{2}:\d{2})?$/).optional().default(""),
  placeId: z.string().optional().default(""),
  capacity: z.coerce.number().int().min(2, "Au moins 2 places.").max(500),
  pricePublic: z.coerce.number().int().min(0).max(10000),
  priceMember: z.coerce.number().int().min(0).max(10000),
  premiumFree: z.boolean().default(false),
  description: z.string().trim().max(2000).optional().default(""),
});

export type EventForm = z.input<typeof eventFormSchema>;
