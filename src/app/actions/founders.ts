"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { checkCapability, getViewer } from "@/lib/auth";
import { nowMs, today, zonedIso } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import type { EventInput } from "@/lib/data/repo";
import { computeDashboard } from "@/lib/domain/founders";
import { fullName, money } from "@/lib/format";
import { eventPublished, paymentValidated } from "@/lib/notify";
import type { Capability } from "@/lib/permissions";
import type { Payment } from "@/lib/types";
import { eventFormSchema, type EventForm } from "@/lib/validation";
import { emitMembershipActivated } from "@/lib/modules/contrats/emit"; // --- Vague 2 · Contrats ---

export type FounderResult = { ok: true; message: string } | { ok: false; error: string };

/** Administratrice ayant la capacité demandée (null sinon). */
async function founder(cap: Capability) {
  return (await checkCapability(cap))?.profile ?? null;
}

async function logValidation(actorId: string, pay: Payment) {
  await audit({
    actorId,
    action: "payment.validate",
    targetType: "payment",
    targetId: pay.id,
    summary: `Virement de ${pay.payerName} validé · ${money(pay.amount)}`,
    details: { amount: pay.amount, kind: pay.kind, plan: pay.plan, bookingId: pay.bookingId },
  });
  await paymentValidated(pay);
  // --- Vague 2 · Contrats --- : adhésion validée → contrat relié (ou généré, à accepter). À reprendre par le chantier paiements.
  await emitMembershipActivated(pay);
}

function refresh() {
  revalidatePath("/", "layout");
}

/** Valider un virement déclaré (billet ou adhésion). */
export async function validatePaymentAction(paymentId: string): Promise<FounderResult> {
  const f = await founder("payments.validate");
  if (!f) return { ok: false, error: "Réservé aux fondatrices." };
  const pay = await getRepo().validatePayment(paymentId, f.id);
  if (!pay) return { ok: false, error: "Ce virement est déjà traité." };
  await logValidation(f.id, pay);
  refresh();
  return { ok: true, message: `Virement de ${pay.payerName} validé · ${money(pay.amount)}` };
}

/** Valider tous les virements déclarés. */
export async function validateAllAction(): Promise<FounderResult> {
  const f = await founder("payments.validate");
  if (!f) return { ok: false, error: "Réservé aux fondatrices." };
  const repo = getRepo();
  const d = computeDashboard(await repo.snapshot(), nowMs());
  let n = 0;
  for (const v of d.vir) {
    const pay = await repo.validatePayment(v.id, f.id);
    if (!pay) continue;
    n++;
    await logValidation(f.id, pay);
  }
  refresh();
  return { ok: true, message: n ? `${n} virement${n > 1 ? "s" : ""} validé${n > 1 ? "s" : ""}` : "Aucun virement à valider." };
}

/** Relancer (renouvellement, adhésion échue, billets impayés) ou inviter un compte gratuit. */
export async function remindAction(key: string): Promise<FounderResult> {
  const f = await founder("reminders.send");
  if (!f) return { ok: false, error: "Réservé aux fondatrices." };
  const repo = getRepo();
  const d = computeDashboard(await repo.snapshot(), nowMs());
  const item = d.rel.find((r) => r.key === key);
  if (!item) return { ok: false, error: "Cette relance est déjà partie." };
  const reminderId = await repo.sendReminder(key, f.id);
  await audit({
    actorId: f.id,
    action: "reminder.send",
    targetType: "reminder",
    targetId: reminderId,
    summary: `${item.cat === "free" ? "Invitation envoyée à " : "Relance envoyée · "}${item.name}`,
    details: { key, category: item.cat, profileId: item.profileId },
  });
  refresh();
  const demo = (await getViewer()).mode === "demo";
  return { ok: true, message: `${item.cat === "free" ? "Invitation envoyée à " : "Relance envoyée · "}${item.name}.${demo ? " Simulé" : ""}` };
}

/** Publier un brouillon. Le lieu est obligatoire : on peut le choisir au moment de publier. */
export async function publishDraftAction(eventId: string, placeId?: string): Promise<FounderResult> {
  const f = await founder("events.manage");
  if (!f) return { ok: false, error: "Réservé aux fondatrices." };
  const repo = getRepo();
  if (placeId) {
    const place = (await repo.listPlaces()).find((p) => p.id === placeId);
    if (!place) return { ok: false, error: "Lieu introuvable." };
    await repo.updateEvent(eventId, { placeId: place.id, venue: place.name, address: place.area });
  }
  try {
    const ev = await repo.publishEvent(eventId);
    await audit({ actorId: f.id, action: "event.publish", targetType: "event", targetId: ev.id, summary: `« ${ev.title} » publié par ${fullName(f)}`, details: { placeId: ev.placeId, startsAt: ev.startsAt } });
    await eventPublished(ev, await repo.listDirectory(), f.id);
    refresh();
    return { ok: true, message: `« ${ev.title} » est publié` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Publication impossible." };
  }
}

export type SaveEventResult = { ok: true; id: string; title: string; created: boolean } | { ok: false; error: string; field?: string };

/** Créer un brouillon ou modifier un rendez-vous. */
export async function saveEventAction(form: EventForm, id?: string): Promise<SaveEventResult> {
  const f = await founder("events.manage");
  if (!f) return { ok: false, error: "Réservé aux fondatrices." };
  const parsed = eventFormSchema.safeParse(form);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0] ?? "") };
  }
  const data = parsed.data;
  if (!id && data.date < today()) return { ok: false, error: "Choisissez une date à venir.", field: "date" };
  if (data.endTime && data.endTime <= data.time) return { ok: false, error: "L’heure de fin doit suivre l’heure de début.", field: "endTime" };
  const repo = getRepo();
  const place = data.placeId ? (await repo.listPlaces()).find((p) => p.id === data.placeId) : null;
  const input: EventInput = {
    title: data.title,
    startsAt: zonedIso(data.date, data.time),
    endsAt: data.endTime ? zonedIso(data.date, data.endTime) : null,
    placeId: place?.id ?? null,
    venue: place?.name ?? null,
    address: place?.area ?? null,
    capacity: data.capacity,
    pricePublic: data.premiumFree ? 0 : data.pricePublic,
    priceMember: data.premiumFree ? 0 : data.priceMember,
    premiumFree: data.premiumFree,
    description: data.description || "Les détails arrivent bientôt.",
    program: [],
  };
  if (id) {
    const existing = await repo.getEventById(id);
    if (!existing) return { ok: false, error: "Rendez-vous introuvable." };
    if (existing.status === "published" && !place) return { ok: false, error: "Un rendez-vous publié garde un lieu.", field: "placeId" };
    const { program, ...rest } = input;
    void program;
    const ev = await repo.updateEvent(id, rest);
    const changed = (Object.keys(rest) as Array<keyof typeof rest>).filter((k) => JSON.stringify(rest[k]) !== JSON.stringify(existing[k]));
    await audit({ actorId: f.id, action: "event.update", targetType: "event", targetId: ev.id, summary: `« ${ev.title} » modifié`, details: { changed } });
    refresh();
    return { ok: true, id: ev.id, title: ev.title, created: false };
  }
  const ev = await repo.createEvent(input, "draft");
  await audit({ actorId: f.id, action: "event.create", targetType: "event", targetId: ev.id, summary: `Brouillon « ${ev.title} » créé`, details: { startsAt: ev.startsAt, capacity: ev.capacity } });
  refresh();
  return { ok: true, id: ev.id, title: ev.title, created: true };
}
