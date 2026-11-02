/**
 * Implémentation « réelle » du Repo : Postgres via Supabase.
 * Lecture et écriture avec la session de la personne (la RLS s'applique) ;
 * les opérations sensibles passent par les fonctions SQL de 0001_init.sql.
 * La clé « service » n'est utilisée que pour Stripe (session de paiement, webhook).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Snapshot } from "../domain/founders";
import { fullName } from "../format";
import { inCircle, isAdmin, isGrantableRole } from "../permissions";
import { supabaseEngagementRepo } from "../modules/engagement/supabase"; // --- Lot 4 ---
import { supabaseAdmin, supabaseServer } from "../supabase/server";
import type {
  AppNotification,
  AuditEntry,
  Booking,
  BookingView,
  ClubEvent,
  DmThread,
  EventView,
  Memory,
  Message,
  MessageView,
  NotificationPref,
  Organization,
  OrganizationMember,
  PartnerOffer,
  Payment,
  Place,
  Profile,
  Reminder,
} from "../types";
import { otherInChannel, type BookResult, type CancelResult, type EventInput, type NotificationInput, type Repo } from "./repo";

/* ---------- lignes de la base (snake_case) ---------- */
type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const strN = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));

function toProfile(r: Row): Profile {
  return {
    id: str(r.id),
    firstName: str(r.first_name),
    lastName: str(r.last_name),
    whatsapp: strN(r.whatsapp),
    email: strN(r.email),
    job: strN(r.job),
    country: strN(r.country),
    bio: strN(r.bio),
    // rôles embarqués : select(PROFILE)
    roles: ((r.user_roles as Row[] | null) ?? []).map((x) => x.role).filter(isGrantableRole),
    plan: (r.plan as Profile["plan"]) ?? "free",
    planEndsAt: strN(r.plan_ends_at),
    avatarUrl: strN(r.avatar_url),
    marrakechSince: strN(r.marrakech_since),
    cardNumber: strN(r.card_number),
    createdAt: str(r.created_at),
  };
}

/** Jointure des rôles (user_roles a deux clés vers profiles : on précise profile_id). */
const ROLES_JOIN = "user_roles:user_roles!user_roles_profile_id_fkey(role)";
/** Profil avec ses rôles. */
const PROFILE = `*, ${ROLES_JOIN}`;

function toOrganization(r: Row): Organization {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name: str(r.name),
    kinds: (r.kinds as Organization["kinds"]) ?? [],
    category: str(r.category),
    description: strN(r.description),
    address: strN(r.address),
    area: strN(r.area),
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    contactName: strN(r.contact_name),
    phone: strN(r.phone),
    email: strN(r.email),
    website: strN(r.website),
    instagram: strN(r.instagram),
    status: (r.status as Organization["status"]) ?? "pending",
    placeId: strN(r.place_id),
    createdAt: str(r.created_at),
  };
}

function toOrgMember(r: Row): OrganizationMember {
  return { organizationId: str(r.organization_id), profileId: str(r.profile_id), role: r.role as OrganizationMember["role"], createdAt: str(r.created_at) };
}

function toAudit(r: Row): AuditEntry {
  return {
    id: str(r.id),
    actorId: strN(r.actor_id),
    action: r.action as AuditEntry["action"],
    targetType: r.target_type as AuditEntry["targetType"],
    targetId: strN(r.target_id),
    summary: str(r.summary),
    details: (r.details as Record<string, unknown>) ?? {},
    createdAt: str(r.created_at),
  };
}

function toNotification(r: Row): AppNotification {
  return {
    id: str(r.id),
    recipientId: str(r.recipient_id),
    type: r.type as AppNotification["type"],
    title: str(r.title),
    body: str(r.body),
    link: strN(r.link),
    readAt: strN(r.read_at),
    createdAt: str(r.created_at),
  };
}

const PREF_COLUMN = { inApp: "in_app", email: "email", push: "push" } as const;

/**
 * Client pour écrire ce que la RLS réserve à soi-même ou aux administratrices (notifications pour une autre
 * personne, ex. liste d'attente libérée par une membre) : clé service si elle est configurée, sinon session.
 * N'est appelé qu'après les vérifications de l'application (server actions).
 */
async function trustedWriter(): Promise<SupabaseClient> {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin() : supabaseServer();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toPlace(r: Row): Place {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name: str(r.name),
    kind: str(r.kind),
    area: str(r.area),
    note: str(r.note),
    categories: (r.categories as Place["categories"]) ?? [],
    recommendedBy: str(r.recommended_by),
    clubEventLabel: strN(r.club_event_label),
    clubEventDate: strN(r.club_event_date),
    url: strN(r.url),
    image: strN(r.image),
    imagePosition: strN(r.image_position),
    phone: strN(r.phone),
    address: strN(r.address),
    hours: strN(r.hours),
    tags: (r.tags as string[] | null) ?? [],
    badge: (strN(r.badge) as Place["badge"]) ?? null,
  };
}

function toEvent(r: Row): ClubEvent {
  return {
    id: str(r.id),
    slug: str(r.slug),
    title: str(r.title),
    shortTitle: strN(r.short_title),
    startsAt: new Date(str(r.starts_at)).toISOString(),
    endsAt: r.ends_at ? new Date(str(r.ends_at)).toISOString() : null,
    placeId: strN(r.place_id),
    venue: strN(r.venue),
    address: strN(r.address),
    description: str(r.description),
    program: (r.program as ClubEvent["program"]) ?? [],
    capacity: num(r.capacity),
    pricePublic: num(r.price_public),
    priceMember: num(r.price_member),
    premiumFree: Boolean(r.premium_free),
    status: (r.status as ClubEvent["status"]) ?? "draft",
    image: strN(r.image),
    imagePosition: strN(r.image_position),
    imageZoom: strN(r.image_zoom),
    imageCaption: strN(r.image_caption),
    featured: Boolean(r.featured),
    createdAt: str(r.created_at),
  };
}

function toBooking(r: Row): Booking {
  return {
    id: str(r.id),
    eventId: str(r.event_id),
    profileId: strN(r.profile_id),
    guestFirstName: strN(r.guest_first_name),
    guestWhatsapp: strN(r.guest_whatsapp),
    status: r.status as Booking["status"],
    amount: num(r.amount),
    method: r.method as Booking["method"],
    ticketCode: str(r.ticket_code),
    stripeSessionId: strN(r.stripe_session_id),
    createdAt: str(r.created_at),
  };
}

function toPayment(r: Row): Payment {
  return {
    id: str(r.id),
    profileId: strN(r.profile_id),
    payerName: str(r.payer_name),
    kind: r.kind as Payment["kind"],
    bookingId: strN(r.booking_id),
    plan: (r.plan as Payment["plan"]) ?? null,
    membershipAction: (r.membership_action as Payment["membershipAction"]) ?? null,
    amount: num(r.amount),
    method: r.method as Payment["method"],
    status: r.status as Payment["status"],
    declaredAt: str(r.declared_at),
    validatedAt: strN(r.validated_at),
    validatedBy: strN(r.validated_by),
    stripeSessionId: strN(r.stripe_session_id),
  };
}

function toMessage(r: Row): Message {
  return { id: str(r.id), channel: str(r.channel), authorId: str(r.author_id), body: str(r.body), createdAt: str(r.created_at), readAt: strN(r.read_at) };
}

function toReminder(r: Row): Reminder {
  return {
    id: str(r.id),
    profileId: strN(r.profile_id),
    eventId: strN(r.event_id),
    reason: r.reason as Reminder["reason"],
    dueAt: strN(r.due_at),
    sentAt: strN(r.sent_at),
    answered: Boolean(r.answered),
    scheduledFor: strN(r.scheduled_for),
  };
}

function eventRow(input: Partial<EventInput>): Row {
  const map: Record<keyof EventInput, string> = {
    title: "title",
    startsAt: "starts_at",
    endsAt: "ends_at",
    placeId: "place_id",
    venue: "venue",
    address: "address",
    capacity: "capacity",
    pricePublic: "price_public",
    priceMember: "price_member",
    premiumFree: "premium_free",
    description: "description",
    program: "program",
  };
  const row: Row = {};
  (Object.keys(input) as Array<keyof EventInput>).forEach((k) => {
    if (input[k] !== undefined) row[map[k]] = input[k];
  });
  return row;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function db(): Promise<SupabaseClient> {
  return supabaseServer();
}

/* ---------- remplissage des rendez-vous ---------- */
type Fill = { paid: number; pending: number; waitlist: number };
async function fills(c: SupabaseClient, ids: string[]): Promise<Map<string, Fill>> {
  const m = new Map<string, Fill>();
  if (!ids.length) return m;
  const rows = check(await c.from("event_fill").select("*").in("event_id", ids)) as Row[];
  rows.forEach((r) => m.set(str(r.event_id), { paid: num(r.paid), pending: num(r.pending), waitlist: num(r.waitlist) }));
  return m;
}

function withStats(e: ClubEvent, f: Fill | undefined): EventView {
  const paid = f?.paid ?? 0;
  const pending = f?.pending ?? 0;
  const taken = paid + pending;
  return { ...e, stats: { taken, paid, pending, waitlist: f?.waitlist ?? 0, left: Math.max(0, e.capacity - taken) } };
}

async function eventViews(c: SupabaseClient, events: ClubEvent[]): Promise<EventView[]> {
  const f = await fills(c, events.map((e) => e.id));
  return events.map((e) => withStats(e, f.get(e.id)));
}

const BOOKING_WITH = "*, event:events(*), profile:profiles(first_name,last_name)";
function bookingView(r: Row): BookingView | null {
  if (!r.event) return null;
  const p = r.profile as Row | null;
  const holder = p ? fullName({ firstName: str(p.first_name), lastName: str(p.last_name) }) : str(r.guest_first_name) || "Invitée";
  return { ...toBooking(r), event: toEvent(r.event as Row), holderName: holder || "Invitée" };
}

function ticketToView(j: Row | null): BookingView | null {
  if (!j || !j.booking) return null;
  const b = j.booking as Row;
  return { ...toBooking({ ...b, guest_whatsapp: null, stripe_session_id: null }), event: toEvent(j.event as Row), holderName: str(j.holder) || "Invitée" };
}

export const supabaseRepo: Repo = {
  // --- Lot 4 --- (engagement : dashboard, boutique, parrainage, business)
  ...supabaseEngagementRepo,

  async getProfile(id) {
    const c = await db();
    const r = check(await c.from("profiles").select(PROFILE).eq("id", id).maybeSingle()) as Row | null;
    return r ? toProfile(r) : null;
  },

  async listDirectory() {
    const c = await db();
    // La RLS ne montre que le cercle (et soi-même) ; on garde les membres, modératrices et administratrices.
    const rows = check(await c.from("profiles").select(PROFILE).order("first_name")) as Row[];
    return rows
      .map(toProfile)
      .filter(inCircle)
      .sort((a, b) => (isAdmin(a) === isAdmin(b) ? a.firstName.localeCompare(b.firstName, "fr") : isAdmin(a) ? -1 : 1));
  },

  async listProfiles() {
    const c = await db();
    return (check(await c.from("profiles").select(PROFILE).order("first_name")) as Row[]).map(toProfile);
  },

  async grantRole(profileId, role, actorId) {
    const c = await db();
    check(await c.from("user_roles").upsert({ profile_id: profileId, role, granted_by: actorId }, { onConflict: "profile_id,role", ignoreDuplicates: true }));
    const p = await this.getProfile(profileId);
    if (!p) throw new Error("Fiche introuvable.");
    return p;
  },
  async revokeRole(profileId, role) {
    const c = await db();
    const res = await c.from("user_roles").delete().eq("profile_id", profileId).eq("role", role);
    if (res.error) throw new Error(res.error.message.includes("last_admin") ? "Il faut garder au moins une administratrice." : res.error.message);
    const p = await this.getProfile(profileId);
    if (!p) throw new Error("Fiche introuvable.");
    return p;
  },

  async listOrganizations(opts) {
    const c = await db();
    let qy = c.from("organizations").select("*").order("name");
    if (opts?.kind) qy = qy.contains("kinds", [opts.kind]);
    return (check(await qy) as Row[]).map(toOrganization);
  },
  async listMyOrganizations(profileId) {
    const c = await db();
    const rows = check(await c.from("organization_members").select("role, organization:organizations(*)").eq("profile_id", profileId)) as Row[];
    return rows
      .filter((r) => r.organization)
      .map((r) => ({ organization: toOrganization(r.organization as Row), role: r.role as OrganizationMember["role"] }));
  },
  async listOrganizationMembers(organizationId) {
    const c = await db();
    const rows = check(await c.from("organization_members").select(`*, profile:profiles(${PROFILE})`).eq("organization_id", organizationId)) as Row[];
    return rows.map((r) => ({ ...toOrgMember(r), profile: r.profile ? toProfile(r.profile as Row) : null }));
  },

  async createGuestProfile() {
    throw new Error("En mode réel, le compte se crée à la connexion par e-mail.");
  },

  async listPlaces() {
    const c = await db();
    return (check(await c.from("places").select("*").order("sort_order")) as Row[]).map(toPlace);
  },
  async listMemories() {
    const c = await db();
    const rows = check(await c.from("memories").select("*").order("sort_order")) as Row[];
    return rows.map(
      (r): Memory => ({
        id: str(r.id),
        title: str(r.title),
        place: str(r.place),
        dateLabel: str(r.date_label),
        participants: num(r.participants),
        image: str(r.image),
        imagePosition: strN(r.image_position),
        attendees: (r.attendees as string[]) ?? [],
        sortOrder: num(r.sort_order),
      }),
    );
  },
  async listPartnerOffers() {
    const c = await db();
    const rows = check(await c.from("partner_offers").select("*").order("sort_order")) as Row[];
    return rows.map((r): PartnerOffer => ({ id: str(r.id), badge: str(r.badge), partner: str(r.partner), detail: str(r.detail), organizationId: strN(r.organization_id) }));
  },

  async listEvents(opts) {
    const c = await db();
    let qy = c.from("events").select("*").order("starts_at");
    const status = opts?.status ?? "published";
    if (status !== "all") qy = qy.eq("status", status);
    if (opts?.fromYmd) qy = qy.gte("starts_at", `${opts.fromYmd}T00:00:00+01:00`);
    return eventViews(c, (check(await qy) as Row[]).map(toEvent));
  },
  async getEventBySlug(slug) {
    const c = await db();
    const r = check(await c.from("events").select("*").eq("slug", slug).maybeSingle()) as Row | null;
    return r ? (await eventViews(c, [toEvent(r)]))[0] : null;
  },
  async getEventById(id) {
    const c = await db();
    const r = check(await c.from("events").select("*").eq("id", id).maybeSingle()) as Row | null;
    return r ? (await eventViews(c, [toEvent(r)]))[0] : null;
  },
  async createEvent(input, status) {
    const c = await db();
    const { slugify } = await import("../domain/events");
    const base = slugify(input.title) || "rendez-vous";
    let slug = base;
    for (let i = 2; ; i++) {
      const exists = check(await c.from("events").select("id").eq("slug", slug).maybeSingle());
      if (!exists) break;
      slug = `${base}-${i}`;
    }
    const place = input.placeId ? (check(await c.from("places").select("*").eq("id", input.placeId).maybeSingle()) as Row | null) : null;
    const row = {
      ...eventRow(input),
      slug,
      status,
      image: place?.image ?? null,
      image_position: place?.image_position ?? null,
      image_caption: place?.image ? `${str(place.name)}, ${str(place.area)}` : null,
    };
    return toEvent(check(await c.from("events").insert(row).select("*").single()) as Row);
  },
  async updateEvent(id, input) {
    const c = await db();
    return toEvent(check(await c.from("events").update(eventRow(input)).eq("id", id).select("*").single()) as Row);
  },
  async publishEvent(id) {
    const c = await db();
    const cur = check(await c.from("events").select("venue").eq("id", id).maybeSingle()) as Row | null;
    if (!cur) throw new Error("Rendez-vous introuvable.");
    if (!cur.venue) throw new Error("Choisissez le lieu avant de publier.");
    return toEvent(check(await c.from("events").update({ status: "published" }).eq("id", id).select("*").single()) as Row);
  },

  async bookEvent(input): Promise<BookResult> {
    const c = await db();
    const res = await c.rpc("book_event", {
      p_event: input.eventId,
      p_guest_first_name: input.guestFirstName,
      p_guest_whatsapp: input.guestWhatsapp,
      p_mode: input.method === "card" ? "stripe" : "transfer",
      p_waitlist: input.waitlistIfFull,
    });
    if (res.error) {
      const m = res.error.message;
      if (m.includes("premium_only")) throw new Error("Ce rendez-vous est réservé aux Premium.");
      if (m.includes("guest")) throw new Error("Prénom et WhatsApp complets, s’il te plaît.");
      throw new Error("Ce rendez-vous n’est pas ouvert aux réservations.");
    }
    const j = res.data as Row;
    if (j.status === "full") return { status: "full" };
    const view = ticketToView((check(await c.rpc("get_ticket", { p_code: j.ticket_code })) as Row | null) ?? null);
    if (!view) throw new Error("Réservation introuvable.");
    const { event, holderName, ...booking } = view;
    void event;
    void holderName;
    if (j.status === "waitlist") return { status: "waitlist", booking, position: num(j.position) };
    if (j.status === "already") return { status: "already", booking };
    return { status: "booked", booking };
  },
  async getBookingByCode(code) {
    const c = await db();
    return ticketToView((check(await c.rpc("get_ticket", { p_code: code })) as Row | null) ?? null);
  },
  async listBookingsByCodes(codes) {
    const out: BookingView[] = [];
    for (const code of codes.slice(-20)) {
      const v = await this.getBookingByCode(code);
      if (v && v.status !== "cancelled") out.push(v);
    }
    return out;
  },
  async listBookingsForProfile(profileId) {
    const c = await db();
    const rows = check(await c.from("bookings").select(BOOKING_WITH).eq("profile_id", profileId).neq("status", "cancelled")) as Row[];
    return rows
      .map(bookingView)
      .filter((x): x is BookingView => !!x)
      .sort((a, b) => (a.event.startsAt < b.event.startsAt ? -1 : 1));
  },
  async cancelBooking(bookingId, profileId): Promise<CancelResult> {
    if (profileId === null) {
      // webhook Stripe (session expirée) : libère la place retenue
      const admin = supabaseAdmin();
      const rows = check(await admin.from("bookings").update({ status: "cancelled" }).eq("id", bookingId).eq("status", "pending").select("event_id")) as Row[];
      if (!rows.length) return { eventId: null, waitlistProfileId: null };
      const eventId = str(rows[0].event_id);
      const next = check(
        await admin.from("bookings").select("profile_id").eq("event_id", eventId).eq("status", "waitlist").not("profile_id", "is", null).order("created_at").limit(1),
      ) as Row[];
      return { eventId, waitlistProfileId: next.length ? strN(next[0].profile_id) : null };
    }
    const c = await db();
    const r = (check(await c.rpc("cancel_booking", { p_booking: bookingId })) as Row | null) ?? {};
    return { eventId: strN(r.event_id), waitlistProfileId: strN(r.waitlist_profile_id) };
  },
  async setBookingStripeSession(bookingId, sessionId) {
    check(await supabaseAdmin().from("bookings").update({ stripe_session_id: sessionId }).eq("id", bookingId));
  },

  async recordMembership(input) {
    if (input.method === "transfer" && input.status === "declared") {
      const c = await db();
      const id = check(await c.rpc("declare_membership", { p_action: input.action, p_plan: input.plan })) as string;
      return toPayment(check(await c.from("payments").select("*").eq("id", id).single()) as Row);
    }
    // carte (Stripe) : paiement en attente, validé par le webhook
    const row = {
      profile_id: input.profileId,
      payer_name: input.payerName,
      kind: "membership",
      plan: input.plan,
      membership_action: input.action,
      amount: input.amount,
      method: "card",
      status: "declared",
      stripe_session_id: input.stripeSessionId ?? null,
    };
    return toPayment(check(await supabaseAdmin().from("payments").insert(row).select("*").single()) as Row);
  },
  async setPaymentStripeSession(paymentId, sessionId) {
    check(await supabaseAdmin().from("payments").update({ stripe_session_id: sessionId }).eq("id", paymentId));
  },
  async listPaymentsForProfile(profileId) {
    const c = await db();
    return (check(await c.from("payments").select("*").eq("profile_id", profileId)) as Row[]).map(toPayment);
  },
  async markStripeSessionPaid(sessionId, meta) {
    check(await supabaseAdmin().rpc("mark_stripe_paid", { p_session: sessionId, p_kind: meta.kind, p_id: meta.id }));
  },

  async listMessages(channel, limit = 200) {
    const c = await db();
    const rows = check(
      await c.from("messages").select(`*, author:profiles(${PROFILE})`).eq("channel", channel).order("created_at", { ascending: false }).limit(limit),
    ) as Row[];
    return rows.reverse().map((r): MessageView => ({ ...toMessage(r), author: r.author ? toProfile(r.author as Row) : null }));
  },
  async postMessage(channel, authorId, body) {
    const c = await db();
    return toMessage(check(await c.from("messages").insert({ channel, author_id: authorId, body }).select("*").single()) as Row);
  },
  async listDmThreads(profileId) {
    const c = await db();
    const rows = (check(await c.from("messages").select("*").like("channel", `dm:%${profileId}%`).order("created_at")) as Row[]).map(toMessage);
    const others = [...new Set(rows.map((m) => otherInChannel(m.channel, profileId)).filter((x): x is string => !!x))];
    const profiles = others.length ? (check(await c.from("profiles").select(PROFILE).in("id", others)) as Row[]).map(toProfile) : [];
    const map = new Map<string, DmThread>();
    for (const m of rows) {
      const other = otherInChannel(m.channel, profileId);
      const op = profiles.find((p) => p.id === other);
      if (!other || !op) continue;
      const t = map.get(other) ?? { other: op, last: null, unread: 0 };
      t.last = m;
      if (m.authorId === other && !m.readAt) t.unread++;
      map.set(other, t);
    }
    return [...map.values()].sort((a, b) => ((a.last?.createdAt ?? "") < (b.last?.createdAt ?? "") ? 1 : -1));
  },
  async markDmRead(profileId, otherId) {
    void profileId;
    const c = await db();
    check(await c.rpc("mark_dm_read", { p_other: otherId }));
  },
  async countUnreadDms(profileId) {
    const c = await db();
    const res = await c.from("messages").select("id", { count: "exact", head: true }).like("channel", `dm:%${profileId}%`).neq("author_id", profileId).is("read_at", null);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  },

  async snapshot(): Promise<Snapshot> {
    const c = await db();
    const [profiles, events, bookings, payments, reminders] = await Promise.all([
      c.from("profiles").select(PROFILE),
      c.from("events").select("*"),
      c.from("bookings").select("*"),
      c.from("payments").select("*").limit(20000),
      c.from("reminders").select("*"),
    ]);
    return {
      profiles: (check(profiles) as Row[]).map(toProfile),
      events: (check(events) as Row[]).map(toEvent),
      bookings: (check(bookings) as Row[]).map(toBooking),
      payments: (check(payments) as Row[]).map(toPayment),
      reminders: (check(reminders) as Row[]).map(toReminder),
    };
  },
  async validatePayment(paymentId) {
    const c = await db();
    const r = check(await c.rpc("validate_payment", { p_payment: paymentId })) as Row | null;
    return r && r.id ? toPayment(r) : null;
  },
  async sendReminder(key, founderId) {
    const c = await db();
    const [kind, id] = key.split(":");
    const base = { sent_at: new Date().toISOString(), answered: false, sent_by: founderId };
    if (kind === "unpaid") {
      const r = check(await c.from("reminders").insert({ ...base, event_id: id, reason: "unpaid" }).select("id").single()) as Row;
      return str(r.id);
    }
    const p = check(await c.from("profiles").select("plan_ends_at").eq("id", id).maybeSingle()) as Row | null;
    if (!p) throw new Error("Fiche introuvable.");
    const reason = kind === "renew" ? "renewal" : kind === "lapsed" ? "expired" : "invite";
    const r = check(await c.from("reminders").insert({ ...base, profile_id: id, reason, due_at: p.plan_ends_at ?? null }).select("id").single()) as Row;
    return str(r.id);
  },

  async logAudit(entry) {
    const c = await db();
    check(
      await c.from("audit_log").insert({
        actor_id: entry.actorId,
        action: entry.action,
        target_type: entry.targetType,
        target_id: entry.targetId && UUID_RE.test(entry.targetId) ? entry.targetId : null,
        summary: entry.summary.slice(0, 300),
        details: entry.details ?? {},
      }),
    );
  },
  async listAudit(opts) {
    const c = await db();
    return (check(await c.from("audit_log").select("*").order("created_at", { ascending: false }).limit(opts?.limit ?? 50)) as Row[]).map(toAudit);
  },

  async createNotifications(rows: NotificationInput[]) {
    if (!rows.length) return 0;
    const c = await trustedWriter();
    // les notifications coupées sont écartées par le déclencheur notifications_respect_prefs
    const res = await c.from("notifications").insert(rows.map((r) => ({ recipient_id: r.recipientId, type: r.type, title: r.title, body: r.body, link: r.link })), { count: "exact" });
    if (res.error) throw new Error(res.error.message);
    return res.count ?? rows.length;
  },
  async listNotifications(profileId, limit = 50) {
    const c = await db();
    return (check(await c.from("notifications").select("*").eq("recipient_id", profileId).order("created_at", { ascending: false }).limit(limit)) as Row[]).map(toNotification);
  },
  async countUnreadNotifications(profileId) {
    const c = await db();
    const res = await c.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", profileId).is("read_at", null);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  },
  async markNotificationsRead(profileId, ids) {
    const c = await db();
    let qy = c.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", profileId).is("read_at", null);
    if (ids !== "all") qy = qy.in("id", ids);
    check(await qy);
  },
  async listNotificationPrefs(profileId) {
    const c = await db();
    const rows = check(await c.from("notification_prefs").select("*").eq("profile_id", profileId)) as Row[];
    return rows.map((r): NotificationPref => ({ profileId: str(r.profile_id), type: r.type as NotificationPref["type"], inApp: Boolean(r.in_app), email: Boolean(r.email), push: Boolean(r.push) }));
  },
  async setNotificationPref(profileId, type, channel, enabled) {
    const c = await db();
    check(
      await c
        .from("notification_prefs")
        .upsert({ profile_id: profileId, type, [PREF_COLUMN[channel]]: enabled, updated_at: new Date().toISOString() }, { onConflict: "profile_id,type" }),
    );
  },
};

