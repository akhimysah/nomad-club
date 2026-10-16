/**
 * Implémentation « démo » du Repo : tout est en mémoire côté serveur,
 * initialisé depuis src/lib/seed.ts et conservé pendant la vie du processus.
 */
import { randomUUID } from "node:crypto";
import { nowIso, today, ymdOf } from "../clock";
import { eventStats, slugify, toEventView } from "../domain/events";
import { applyMembership } from "../domain/membership";
import { newTicketCode } from "../domain/tickets";
import { fullName } from "../format";
import { createSeed, type SeedData } from "../seed";
import type { Booking, BookingView, ClubEvent, DmThread, MessageView, Payment, Profile } from "../types";
import { dmChannel, otherInChannel, type BookResult, type Repo } from "./repo";

type DemoGlobal = typeof globalThis & { __nomadDemoDb?: SeedData };

function db(): SeedData {
  const g = globalThis as DemoGlobal;
  if (!g.__nomadDemoDb) g.__nomadDemoDb = createSeed();
  return g.__nomadDemoDb;
}

const clone = <T>(v: T): T => structuredClone(v);

function bookingView(d: SeedData, b: Booking): BookingView | null {
  const event = d.events.find((e) => e.id === b.eventId);
  if (!event) return null;
  const p = b.profileId ? d.profiles.find((x) => x.id === b.profileId) : null;
  return clone({ ...b, event, holderName: p ? fullName(p) : b.guestFirstName ?? "Invitée" });
}

function applyValidatedMembership(d: SeedData, pay: Payment) {
  if (pay.kind !== "membership" || !pay.profileId || !pay.plan || !pay.membershipAction) return;
  const p = d.profiles.find((x) => x.id === pay.profileId);
  if (!p) return;
  const r = applyMembership(p, pay.membershipAction, pay.plan, today());
  p.plan = r.plan;
  p.planEndsAt = r.planEndsAt;
  p.role = r.role;
  if (!p.cardNumber) p.cardNumber = `NC 0${600 + d.profiles.length}`;
  d.memberships.forEach((m) => {
    if (m.profileId === p.id && m.status === "active") m.status = r.startsAt >= m.endsAt ? "expired" : m.status;
  });
  d.memberships.push({ id: randomUUID(), profileId: p.id, plan: r.plan, startsAt: r.startsAt, endsAt: r.planEndsAt, status: "active" });
}

export const demoRepo: Repo = {
  async getProfile(id) {
    const p = db().profiles.find((x) => x.id === id);
    return p ? clone(p) : null;
  },

  async listDirectory() {
    return clone(
      db()
        .profiles.filter((p) => p.role === "member" || p.role === "founder")
        .sort((a, b) => (a.role === b.role ? a.firstName.localeCompare(b.firstName, "fr") : a.role === "founder" ? -1 : 1)),
    );
  },

  async createGuestProfile(input) {
    const d = db();
    const existing = input.whatsapp ? d.profiles.find((p) => p.whatsapp && p.whatsapp.replace(/\D/g, "") === input.whatsapp!.replace(/\D/g, "")) : null;
    if (existing) return clone(existing);
    const p: Profile = {
      id: randomUUID(),
      firstName: input.firstName,
      lastName: input.lastName,
      whatsapp: input.whatsapp,
      email: input.email,
      job: null,
      country: null,
      bio: null,
      role: "guest",
      plan: "free",
      planEndsAt: null,
      avatarUrl: null,
      marrakechSince: null,
      cardNumber: null,
      createdAt: nowIso(),
    };
    d.profiles.push(p);
    return clone(p);
  },

  async listPlaces() {
    return clone(db().places);
  },
  async listMemories() {
    return clone([...db().memories].sort((a, b) => a.sortOrder - b.sortOrder));
  },
  async listPartnerOffers() {
    return clone(db().partnerOffers);
  },

  async listEvents(opts) {
    const d = db();
    const status = opts?.status ?? "published";
    return clone(
      d.events
        .filter((e) => (status === "all" ? true : e.status === status))
        .filter((e) => !opts?.fromYmd || ymdOf(e.startsAt) >= opts.fromYmd)
        .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
        .map((e) => toEventView(e, d.bookings)),
    );
  },
  async getEventBySlug(slug) {
    const d = db();
    const e = d.events.find((x) => x.slug === slug);
    return e ? clone(toEventView(e, d.bookings)) : null;
  },
  async getEventById(id) {
    const d = db();
    const e = d.events.find((x) => x.id === id);
    return e ? clone(toEventView(e, d.bookings)) : null;
  },
  async createEvent(input, status) {
    const d = db();
    let slug = slugify(input.title) || "rendez-vous";
    while (d.events.some((e) => e.slug === slug)) slug += "-" + Math.floor(Math.random() * 90 + 10);
    const place = input.placeId ? d.places.find((p) => p.id === input.placeId) : null;
    const e: ClubEvent = {
      id: randomUUID(),
      slug,
      title: input.title,
      shortTitle: null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      placeId: input.placeId,
      venue: input.venue,
      address: input.address,
      description: input.description,
      program: input.program,
      capacity: input.capacity,
      pricePublic: input.pricePublic,
      priceMember: input.priceMember,
      premiumFree: input.premiumFree,
      status,
      image: place?.image ?? null,
      imagePosition: place?.imagePosition ?? null,
      imageZoom: null,
      imageCaption: place?.image ? `${place.name}, ${place.area}` : null,
      featured: false,
      createdAt: nowIso(),
    };
    d.events.push(e);
    return clone(e);
  },
  async updateEvent(id, input) {
    const d = db();
    const e = d.events.find((x) => x.id === id);
    if (!e) throw new Error("Rendez-vous introuvable.");
    Object.assign(e, input);
    if (input.placeId) {
      const place = d.places.find((p) => p.id === input.placeId);
      if (place && !e.image && place.image) {
        e.image = place.image;
        e.imagePosition = place.imagePosition;
        e.imageCaption = `${place.name}, ${place.area}`;
      }
    }
    return clone(e);
  },
  async publishEvent(id) {
    const d = db();
    const e = d.events.find((x) => x.id === id);
    if (!e) throw new Error("Rendez-vous introuvable.");
    if (!e.venue) throw new Error("Choisissez le lieu avant de publier.");
    e.status = "published";
    return clone(e);
  },

  async bookEvent(input): Promise<BookResult> {
    const d = db();
    const e = d.events.find((x) => x.id === input.eventId && x.status === "published");
    if (!e) throw new Error("Ce rendez-vous n’est pas ouvert aux réservations.");
    const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");
    const existing = d.bookings.find(
      (b) =>
        b.eventId === e.id &&
        b.status !== "cancelled" &&
        ((input.profileId && b.profileId === input.profileId) || (!input.profileId && input.guestWhatsapp && digits(b.guestWhatsapp) === digits(input.guestWhatsapp))),
    );
    if (existing) return { status: "already", booking: clone(existing) };
    const stats = eventStats(e, d.bookings);
    const base = {
      eventId: e.id,
      profileId: input.profileId,
      guestFirstName: input.guestFirstName,
      guestWhatsapp: input.guestWhatsapp,
      ticketCode: newTicketCode(e.startsAt),
      stripeSessionId: null,
      createdAt: nowIso(),
    };
    if (stats.left <= 0) {
      if (!input.waitlistIfFull) return { status: "full" };
      const b: Booking = { id: randomUUID(), ...base, status: "waitlist", amount: 0, method: input.method };
      d.bookings.push(b);
      return { status: "waitlist", booking: clone(b), position: stats.waitlist + 1 };
    }
    const b: Booking = { id: randomUUID(), ...base, status: input.initialStatus, amount: input.amount, method: input.method };
    d.bookings.push(b);
    const payer = input.profileId ? d.profiles.find((p) => p.id === input.profileId) : null;
    if ((input.initialStatus === "paid" && input.amount > 0) || input.declareTransfer) {
      d.payments.push({
        id: randomUUID(),
        profileId: input.profileId,
        payerName: payer ? fullName(payer) : input.guestFirstName ?? "Invitée",
        kind: "booking",
        bookingId: b.id,
        plan: null,
        membershipAction: null,
        amount: input.amount,
        method: input.method,
        status: input.declareTransfer ? "declared" : "validated",
        declaredAt: nowIso(),
        validatedAt: input.declareTransfer ? null : nowIso(),
        validatedBy: null,
        stripeSessionId: null,
      });
    }
    return { status: "booked", booking: clone(b) };
  },
  async getBookingByCode(code) {
    const d = db();
    const b = d.bookings.find((x) => x.ticketCode === code);
    return b ? bookingView(d, b) : null;
  },
  async listBookingsByCodes(codes) {
    const d = db();
    return d.bookings
      .filter((b) => codes.includes(b.ticketCode) && b.status !== "cancelled")
      .map((b) => bookingView(d, b))
      .filter((x): x is BookingView => !!x);
  },
  async listBookingsForProfile(profileId) {
    const d = db();
    return d.bookings
      .filter((b) => b.profileId === profileId && b.status !== "cancelled")
      .map((b) => bookingView(d, b))
      .filter((x): x is BookingView => !!x)
      .sort((a, b) => (a.event.startsAt < b.event.startsAt ? -1 : 1));
  },
  async cancelBooking(bookingId, profileId) {
    const b = db().bookings.find((x) => x.id === bookingId && (profileId === null || x.profileId === profileId));
    if (b) b.status = "cancelled";
  },
  async setBookingStripeSession(bookingId, sessionId) {
    const b = db().bookings.find((x) => x.id === bookingId);
    if (b) b.stripeSessionId = sessionId;
  },

  async recordMembership(input) {
    const d = db();
    const pay: Payment = {
      id: randomUUID(),
      profileId: input.profileId,
      payerName: input.payerName,
      kind: "membership",
      bookingId: null,
      plan: input.plan,
      membershipAction: input.action,
      amount: input.amount,
      method: input.method,
      status: input.status,
      declaredAt: nowIso(),
      validatedAt: input.status === "validated" ? nowIso() : null,
      validatedBy: null,
      stripeSessionId: input.stripeSessionId ?? null,
    };
    d.payments.push(pay);
    if (input.status === "validated") applyValidatedMembership(d, pay);
    return clone(pay);
  },
  async setPaymentStripeSession(paymentId, sessionId) {
    const p = db().payments.find((x) => x.id === paymentId);
    if (p) p.stripeSessionId = sessionId;
  },
  async listPaymentsForProfile(profileId) {
    return clone(db().payments.filter((p) => p.profileId === profileId));
  },
  async markStripeSessionPaid(sessionId, meta) {
    const d = db();
    if (meta.kind === "booking") {
      const b = d.bookings.find((x) => x.id === meta.id);
      if (!b || b.status === "paid") return;
      b.status = "paid";
      b.stripeSessionId = sessionId;
      const p = b.profileId ? d.profiles.find((x) => x.id === b.profileId) : null;
      d.payments.push({
        id: randomUUID(), profileId: b.profileId, payerName: p ? fullName(p) : b.guestFirstName ?? "Invitée", kind: "booking", bookingId: b.id,
        plan: null, membershipAction: null, amount: b.amount, method: "card", status: "validated", declaredAt: nowIso(), validatedAt: nowIso(), validatedBy: null, stripeSessionId: sessionId,
      });
    } else {
      const pay = d.payments.find((x) => x.id === meta.id);
      if (!pay || pay.status === "validated") return;
      pay.status = "validated";
      pay.validatedAt = nowIso();
      pay.stripeSessionId = sessionId;
      applyValidatedMembership(d, pay);
    }
  },

  async listMessages(channel, limit = 200) {
    const d = db();
    return clone(
      d.messages
        .filter((m) => m.channel === channel)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .slice(-limit)
        .map((m): MessageView => ({ ...m, author: d.profiles.find((p) => p.id === m.authorId) ?? null })),
    );
  },
  async postMessage(channel, authorId, body) {
    const m = { id: randomUUID(), channel, authorId, body, createdAt: nowIso(), readAt: null };
    db().messages.push(m);
    return clone(m);
  },
  async listDmThreads(profileId) {
    const d = db();
    const map = new Map<string, DmThread>();
    for (const m of [...d.messages].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) {
      const other = otherInChannel(m.channel, profileId);
      if (!other) continue;
      const op = d.profiles.find((p) => p.id === other);
      if (!op) continue;
      const t = map.get(other) ?? { other: op, last: null, unread: 0 };
      t.last = m;
      if (m.authorId === other && !m.readAt) t.unread++;
      map.set(other, t);
    }
    return clone([...map.values()].sort((a, b) => ((a.last?.createdAt ?? "") < (b.last?.createdAt ?? "") ? 1 : -1)));
  },
  async markDmRead(profileId, otherId) {
    const ch = dmChannel(profileId, otherId);
    db().messages.forEach((m) => {
      if (m.channel === ch && m.authorId === otherId && !m.readAt) m.readAt = nowIso();
    });
  },
  async countUnreadDms(profileId) {
    return db().messages.filter((m) => !m.readAt && m.authorId !== profileId && otherInChannel(m.channel, profileId)).length;
  },

  async snapshot() {
    const d = db();
    return clone({ profiles: d.profiles, events: d.events, bookings: d.bookings, payments: d.payments, reminders: d.reminders });
  },
  async validatePayment(paymentId, founderId) {
    const d = db();
    const pay = d.payments.find((x) => x.id === paymentId);
    if (!pay || pay.status !== "declared") return null;
    pay.status = "validated";
    pay.validatedAt = nowIso();
    pay.validatedBy = founderId;
    if (pay.kind === "booking" && pay.bookingId) {
      const b = d.bookings.find((x) => x.id === pay.bookingId);
      if (b && b.status === "pending") b.status = "paid";
    }
    applyValidatedMembership(d, pay);
    return clone(pay);
  },
  async sendReminder(key) {
    const d = db();
    const [kind, id] = key.split(":");
    const base = { id: randomUUID(), sentAt: nowIso(), answered: false, scheduledFor: null };
    if (kind === "unpaid") {
      d.reminders.push({ ...base, profileId: null, eventId: id, reason: "unpaid", dueAt: null });
      return;
    }
    const p = d.profiles.find((x) => x.id === id);
    if (!p) throw new Error("Fiche introuvable.");
    const reason = kind === "renew" ? "renewal" : kind === "lapsed" ? "expired" : "invite";
    d.reminders.push({ ...base, profileId: p.id, eventId: null, reason, dueAt: p.planEndsAt });
  },
};
