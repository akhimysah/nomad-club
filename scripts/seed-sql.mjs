// Génère supabase/seed.sql à partir de src/lib/seed.ts (mêmes données que le mode démo).
// Utilisation : npm run seed:sql
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { createSeed } = await import(join(root, "src/lib/seed.ts"));
const s = createSeed();

/** Identifiant texte du mode démo -> UUID stable. */
const uuid = (id) => {
  if (id == null) return null;
  const h = createHash("md5").update("nomad-club:" + id).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const q = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "'" + String(v).replace(/'/g, "''") + "'";
};
const arr = (a) => (a.length ? `array[${a.map(q).join(", ")}]::text[]` : "'{}'::text[]");
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;
const dm = (channel) =>
  channel === "general" ? "general" : channel.startsWith("group:") ? "group:" + uuid(channel.slice(6)) /* Lot 1 */ : "dm:" + channel.slice(3).split(":").map(uuid).sort().join(":");

const lines = [];
const out = (x) => lines.push(x);
const insert = (table, cols, rows, conflict = "") => {
  if (!rows.length) return;
  out(`insert into ${table.includes(".") ? table : "public." + table} (${cols.join(", ")}) values`);
  out(rows.map((r) => `  (${r.join(", ")})`).join(",\n") + (conflict ? `\n${conflict};` : ";"));
  out("");
};

out("-- Données d'exemple du Nomad Club (générées par scripts/seed-sql.mjs depuis src/lib/seed.ts).");
out("-- Date de référence : mercredi 14 octobre 2026. À exécuter APRÈS toutes les migrations (supabase/migrations/*.sql).");
out("-- Attention : ces comptes sont fictifs. Ne lancez pas ce fichier sur la base de production réelle.");
out("");
out("begin;");
out("select set_config('nc.trusted', 'on', true);");
out("");

out("-- Comptes (auth.users) des profils d'exemple : le déclencheur crée les profils, complétés juste après.");
insert(
  "auth.users",
  ["instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "raw_app_meta_data", "raw_user_meta_data", "created_at", "updated_at"],
  s.profiles.map((p) => [q("00000000-0000-0000-0000-000000000000"), q(uuid(p.id)), q("authenticated"), q("authenticated"), q(p.email), q(""), q(p.createdAt), json({ provider: "email", providers: ["email"] }), json({ first_name: p.firstName }), q(p.createdAt), q(p.createdAt)]),
  "on conflict (id) do nothing",
);

insert(
  "profiles",
  ["id", "first_name", "last_name", "whatsapp", "email", "job", "country", "bio", "plan", "plan_ends_at", "marrakech_since", "card_number", "created_at"],
  s.profiles.map((p) => [q(uuid(p.id)), q(p.firstName), q(p.lastName), q(p.whatsapp), q(p.email), q(p.job), q(p.country), q(p.bio), q(p.plan), q(p.planEndsAt), q(p.marrakechSince), q(p.cardNumber), q(p.createdAt)]),
  "on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name, whatsapp = excluded.whatsapp, email = excluded.email, job = excluded.job, country = excluded.country, bio = excluded.bio, plan = excluded.plan, plan_ends_at = excluded.plan_ends_at, marrakech_since = excluded.marrakech_since, card_number = excluded.card_number, created_at = excluded.created_at",
);

out("-- Rôles cumulables (0003_socle.sql).");
insert(
  "user_roles",
  ["profile_id", "role", "granted_at"],
  s.profiles.flatMap((p) => p.roles.map((r) => [q(uuid(p.id)), q(r), q(p.createdAt)])),
  "on conflict do nothing",
);

insert(
  "places",
  ["id", "slug", "name", "kind", "area", "note", "categories", "recommended_by", "club_event_label", "club_event_date", "url", "image", "image_position", "sort_order"],
  // Les lieux du club seulement : l'annuaire est inséré par supabase/migrations/0002_carnet_annuaire.sql.
  s.places.filter((p) => !p.id.startsWith("an-")).map((p, i) => [q(uuid(p.id)), q(p.slug), q(p.name), q(p.kind), q(p.area), q(p.note), arr(p.categories), q(p.recommendedBy), q(p.clubEventLabel), q(p.clubEventDate), q(p.url), q(p.image), q(p.imagePosition), i]),
);

insert(
  "events",
  ["id", "slug", "title", "short_title", "starts_at", "ends_at", "place_id", "venue", "address", "description", "program", "capacity", "price_public", "price_member", "premium_free", "status", "image", "image_position", "image_zoom", "image_caption", "featured", "created_at"],
  s.events.map((e) => [q(uuid(e.id)), q(e.slug), q(e.title), q(e.shortTitle), q(e.startsAt), q(e.endsAt), q(uuid(e.placeId)), q(e.venue), q(e.address), q(e.description), json(e.program), e.capacity, e.pricePublic, e.priceMember, q(e.premiumFree), q(e.status), q(e.image), q(e.imagePosition), q(e.imageZoom), q(e.imageCaption), q(e.featured), q(e.createdAt)]),
);

insert(
  "bookings",
  ["id", "event_id", "profile_id", "guest_first_name", "guest_whatsapp", "status", "amount", "method", "ticket_code", "created_at"],
  s.bookings.map((b) => [q(uuid(b.id)), q(uuid(b.eventId)), q(uuid(b.profileId)), q(b.guestFirstName), q(b.guestWhatsapp), q(b.status), b.amount, q(b.method === "free" || b.status === "waitlist" ? "free" : b.method), q(b.ticketCode), q(b.createdAt)]),
);

insert(
  "payments",
  ["id", "profile_id", "payer_name", "kind", "booking_id", "plan", "membership_action", "amount", "method", "status", "declared_at", "validated_at", "validated_by"],
  s.payments.map((p) => [q(uuid(p.id)), q(uuid(p.profileId)), q(p.payerName), q(p.kind), q(uuid(p.bookingId)), q(p.plan), q(p.membershipAction), p.amount, q(p.method), q(p.status), q(p.declaredAt), q(p.validatedAt), q(uuid(p.validatedBy))]),
);

insert(
  "memberships",
  ["id", "profile_id", "plan", "starts_at", "ends_at", "status"],
  s.memberships.map((m) => [q(uuid(m.id)), q(uuid(m.profileId)), q(m.plan), q(m.startsAt), q(m.endsAt), q(m.status)]),
);

insert(
  "memories",
  ["id", "title", "place", "date_label", "participants", "image", "image_position", "attendees", "sort_order"],
  s.memories.map((m) => [q(uuid(m.id)), q(m.title), q(m.place), q(m.dateLabel), m.participants, q(m.image), q(m.imagePosition), arr(m.attendees), m.sortOrder]),
);

insert(
  "messages",
  ["id", "channel", "author_id", "body", "created_at", "read_at"],
  s.messages.map((m) => [q(uuid(m.id)), q(dm(m.channel)), q(uuid(m.authorId)), q(m.body), q(m.createdAt), q(m.readAt)]),
);

insert(
  "reminders",
  ["id", "profile_id", "event_id", "reason", "due_at", "sent_at", "answered", "scheduled_for"],
  s.reminders.map((r) => [q(uuid(r.id)), q(uuid(r.profileId)), q(uuid(r.eventId)), q(r.reason), q(r.dueAt), q(r.sentAt), q(r.answered), q(r.scheduledFor)]),
);

out("-- Organisations, journal et notifications (0003_socle.sql).");
insert(
  "organizations",
  ["id", "slug", "name", "kinds", "category", "description", "address", "area", "lat", "lng", "contact_name", "phone", "email", "website", "instagram", "status", "place_id", "created_at"],
  s.organizations.map((o) => [q(uuid(o.id)), q(o.slug), q(o.name), arr(o.kinds), q(o.category), q(o.description), q(o.address), q(o.area), q(o.lat), q(o.lng), q(o.contactName), q(o.phone), q(o.email), q(o.website), q(o.instagram), q(o.status), q(uuid(o.placeId)), q(o.createdAt)]),
);

insert(
  "organization_members",
  ["organization_id", "profile_id", "role", "created_at"],
  s.organizationMembers.map((m) => [q(uuid(m.organizationId)), q(uuid(m.profileId)), q(m.role), q(m.createdAt)]),
);

insert(
  "partner_offers",
  ["id", "badge", "partner", "detail", "organization_id", "sort_order"],
  s.partnerOffers.map((o, i) => [q(uuid(o.id)), q(o.badge), q(o.partner), q(o.detail), q(uuid(o.organizationId)), i]),
);

insert(
  "audit_log",
  ["id", "actor_id", "action", "target_type", "target_id", "summary", "details", "created_at"],
  s.auditLog.map((a) => [q(uuid(a.id)), q(uuid(a.actorId)), q(a.action), q(a.targetType), q(uuid(a.targetId)), q(a.summary), json(a.details), q(a.createdAt)]),
);

insert(
  "notifications",
  ["id", "recipient_id", "type", "title", "body", "link", "read_at", "created_at"],
  s.notifications.map((n) => [q(uuid(n.id)), q(uuid(n.recipientId)), q(n.type), q(n.title), q(n.body), q(n.link), q(n.readAt), q(n.createdAt)]),
);

insert(
  "notification_prefs",
  ["profile_id", "type", "in_app", "email", "push"],
  s.notificationPrefs.map((p) => [q(uuid(p.profileId)), q(p.type), q(p.inApp), q(p.email), q(p.push)]),
);

// --- Lot 1 ---
(await import("./seed-sql/communaute.mjs")).communauteSeedSql(s, { uuid, q, arr, out, insert });

out("select setval('public.card_number_seq', 700, false);");
out("commit;");

writeFileSync(join(root, "supabase/seed.sql"), lines.join("\n") + "\n");
console.log(`supabase/seed.sql écrit (${s.profiles.length} profils, ${s.events.length} rendez-vous, ${s.payments.length} paiements, ${s.organizations.length} organisations).`);
