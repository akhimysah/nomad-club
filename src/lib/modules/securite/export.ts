/**
 * Lot 6 — export RGPD (droit d'accès et de portabilité) : toutes les données d'une personne, en JSON.
 * Ne contient que ce qui la concerne : ses messages (pas ceux des autres), ses réservations, paiements, etc.
 * À compléter par chaque lot qui ajoute des données personnelles (voir docs/securite/donnees.md).
 */
import { nowIso } from "../../clock";
import { getRepo } from "../../data";
import type { Profile } from "../../types";

export const EXPORT_VERSION = 1;

export async function buildPersonalExport(profile: Profile): Promise<Record<string, unknown>> {
  const repo = getRepo();
  const [consents, deletions, bookings, payments, notifications, prefs, orgs, extras] = await Promise.all([
    repo.listConsents(profile.id),
    repo.listMyDeletionRequests(profile.id),
    repo.listBookingsForProfile(profile.id),
    repo.listPaymentsForProfile(profile.id),
    repo.listNotifications(profile.id, 1000),
    repo.listNotificationPrefs(profile.id),
    repo.listMyOrganizations(profile.id),
    repo.personalDataExtras(profile.id),
  ]);
  return {
    export: {
      version: EXPORT_VERSION,
      generatedAt: nowIso(),
      about: "Export de tes données personnelles Nomad Club (RGPD art. 15 et 20 ; loi marocaine 09-08).",
      contact: "Pour toute question : écris aux fondatrices (voir /confidentialite).",
    },
    profile: {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      whatsapp: profile.whatsapp,
      job: profile.job,
      country: profile.country,
      bio: profile.bio,
      marrakechSince: profile.marrakechSince,
      plan: profile.plan,
      planEndsAt: profile.planEndsAt,
      cardNumber: profile.cardNumber,
      roles: profile.roles,
      createdAt: profile.createdAt,
    },
    consents,
    deletionRequests: deletions,
    bookings: bookings.map((b) => ({
      id: b.id,
      ticketCode: b.ticketCode,
      status: b.status,
      amount: b.amount,
      method: b.method,
      createdAt: b.createdAt,
      event: { title: b.event.title, startsAt: b.event.startsAt, venue: b.event.venue },
    })),
    payments: payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      plan: p.plan,
      amount: p.amount,
      method: p.method,
      status: p.status,
      declaredAt: p.declaredAt,
      validatedAt: p.validatedAt,
    })),
    memberships: extras.memberships,
    messages: extras.authoredMessages.map((m) => ({ ...m, channel: m.channel === "general" ? "salon général" : m.channel.startsWith("dm:") ? "message privé" : m.channel })),
    notifications: notifications.map((n) => ({ type: n.type, title: n.title, body: n.body, readAt: n.readAt, createdAt: n.createdAt })),
    notificationPreferences: prefs,
    organizations: orgs.map((o) => ({ name: o.organization.name, role: o.role })),
    pushSubscriptions: extras.pushSubscriptions,
    operationsLog: extras.auditAboutMe.map((e) => ({ action: e.action, summary: e.summary, createdAt: e.createdAt })),
  };
}
