/**
 * Lot 3 — implémentation Supabase du PartenairesRepo (RLS de 0005_partenaires.sql).
 * Les opérations sensibles passent par les fonctions SQL : claim_offer_code, validate_offer_code,
 * track_org_event, invite_org_member. Les paiements d'abonnement (simulés, puis réels au Lot 2)
 * sont écrits avec la clé service (`trusted`), après les vérifications de l'application.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Organization } from "../../types";
import { emptyMonth, lastMonths } from "./domain";
import type { PartenairesRepo } from "./repo";
import type {
  Establishment,
  EstablishmentDetails,
  MemberLocation,
  MemberPin,
  Offer,
  OfferCode,
  OfferInput,
  OrgInvite,
  ProSubscription,
  SubscriptionPayment,
} from "./types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const strN = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numN = (v: unknown): number | null => (v == null ? null : Number(v));

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function toOrganization(r: Row): Organization {
  return {
    id: str(r.id), slug: str(r.slug), name: str(r.name), kinds: (r.kinds as Organization["kinds"]) ?? [], category: str(r.category),
    description: strN(r.description), address: strN(r.address), area: strN(r.area), lat: numN(r.lat), lng: numN(r.lng),
    contactName: strN(r.contact_name), phone: strN(r.phone), email: strN(r.email), website: strN(r.website), instagram: strN(r.instagram),
    status: (r.status as Organization["status"]) ?? "pending", placeId: strN(r.place_id), createdAt: str(r.created_at),
  };
}

function toDetails(orgId: string, r: Row | null | undefined): EstablishmentDetails {
  return {
    organizationId: orgId,
    photos: (r?.photos as string[] | null) ?? [],
    hours: strN(r?.hours),
    whatsapp: strN(r?.whatsapp),
    carnetCategory: (strN(r?.carnet_category) as EstablishmentDetails["carnetCategory"]) ?? null,
    memberDiscount: strN(r?.member_discount),
    updatedAt: str(r?.updated_at),
  };
}

/** Organisation + fiche : select("*, establishment_details(*)"). */
function toEstablishment(r: Row): Establishment {
  const o = toOrganization(r);
  const det = r.establishment_details as Row | Row[] | null;
  return { ...o, details: toDetails(o.id, Array.isArray(det) ? det[0] : det) };
}
const EST = "*, establishment_details(*)";

function toOffer(r: Row): Offer {
  return {
    id: str(r.id), badge: str(r.badge), partner: str(r.partner), detail: str(r.detail), organizationId: strN(r.organization_id),
    title: str(r.title) || str(r.detail), conditions: strN(r.conditions), validFrom: strN(r.valid_from), validUntil: strN(r.valid_until),
    audience: (r.audience as Offer["audience"]) ?? "all", status: (r.status as Offer["status"]) ?? "active", createdAt: str(r.created_at),
  };
}
function offerRow(input: OfferInput): Row {
  return { title: input.title, badge: input.badge, detail: input.detail, conditions: input.conditions, valid_from: input.validFrom, valid_until: input.validUntil, audience: input.audience };
}

function toCode(r: Row): OfferCode {
  return {
    id: str(r.id), offerId: str(r.offer_id), organizationId: strN(r.organization_id), profileId: str(r.profile_id), code: str(r.code),
    createdAt: str(r.created_at), validatedAt: strN(r.validated_at), validatedBy: strN(r.validated_by),
  };
}

function toSubscription(r: Row): ProSubscription {
  return {
    organizationId: str(r.organization_id), plan: r.plan as ProSubscription["plan"], monthlyPrice: num(r.monthly_price), status: r.status as ProSubscription["status"],
    startedAt: str(r.started_at), currentPeriodEnd: str(r.current_period_end), cancelAtPeriodEnd: Boolean(r.cancel_at_period_end), updatedAt: str(r.updated_at),
    // --- Vague 2 · paiements --- (colonnes de 0009 ; absentes avant la migration)
    provider: r.provider == null ? undefined : str(r.provider), subscriptionRef: strN(r.subscription_ref), customerRef: strN(r.customer_ref),
  };
}

function toSubPayment(r: Row): SubscriptionPayment {
  return {
    id: str(r.id), organizationId: str(r.organization_id), plan: r.plan as SubscriptionPayment["plan"], amount: num(r.amount), status: r.status as SubscriptionPayment["status"],
    method: r.method as SubscriptionPayment["method"], reference: str(r.reference), periodStart: str(r.period_start), periodEnd: str(r.period_end), createdAt: str(r.created_at),
  };
}

function toInvite(r: Row): OrgInvite {
  return {
    id: str(r.id), organizationId: str(r.organization_id), email: str(r.email), invitedBy: strN(r.invited_by), createdAt: str(r.created_at),
    acceptedAt: strN(r.accepted_at), acceptedBy: strN(r.accepted_by),
  };
}

function toLocation(r: Row): MemberLocation {
  return {
    profileId: str(r.profile_id), sharing: Boolean(r.sharing), precision: (r.precision as MemberLocation["precision"]) ?? "area", display: (r.display as MemberLocation["display"]) ?? "name",
    area: strN(r.area), lat: numN(r.lat), lng: numN(r.lng), consentedAt: strN(r.consented_at), updatedAt: str(r.updated_at),
  };
}

/** Message SQL lisible (les fonctions lèvent des exceptions en français). */
const sqlMessage = (e: { message: string } | null) => (e?.message ?? "Opération impossible.").replace(/^.*?ERROR:\s*/, "");

export function partenairesSupabase(db: () => Promise<SupabaseClient>, trusted: () => Promise<SupabaseClient>, todayYmd: () => string): PartenairesRepo {
  return {
    async listEstablishments(opts) {
      const c = await db();
      let q = c.from("organizations").select(EST).order("name");
      if (opts?.kind) q = q.contains("kinds", [opts.kind]);
      if (opts?.activeOnly) q = q.eq("status", "active");
      return (check(await q) as Row[]).map(toEstablishment);
    },
    async getEstablishment(idOrSlug) {
      const c = await db();
      const col = /^[0-9a-f-]{36}$/i.test(idOrSlug) ? "id" : "slug";
      const r = check(await c.from("organizations").select(EST).eq(col, idOrSlug).maybeSingle()) as Row | null;
      return r ? toEstablishment(r) : null;
    },
    async updateEstablishment(organizationId, input) {
      const c = await db();
      check(
        await c
          .from("organizations")
          .update({ description: input.description, address: input.address, area: input.area, lat: input.lat, lng: input.lng, phone: input.phone, email: input.email, website: input.website, instagram: input.instagram })
          .eq("id", organizationId),
      );
      check(
        await c.from("establishment_details").upsert({
          organization_id: organizationId, photos: input.photos, hours: input.hours, whatsapp: input.whatsapp, carnet_category: input.carnetCategory, member_discount: input.memberDiscount, updated_at: new Date().toISOString(),
        }),
      );
      const e = await this.getEstablishment(organizationId);
      if (!e) throw new Error("Établissement introuvable.");
      return e;
    },

    async listOffers(opts) {
      const c = await db();
      let q = c.from("partner_offers").select("*").order("created_at", { ascending: false });
      if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
      if (opts?.activeOnly) q = q.eq("status", "active").or(`valid_until.is.null,valid_until.gte.${todayYmd()}`);
      return (check(await q) as Row[]).map(toOffer);
    },
    async getOffer(id) {
      const c = await db();
      const r = check(await c.from("partner_offers").select("*").eq("id", id).maybeSingle()) as Row | null;
      return r ? toOffer(r) : null;
    },
    async createOffer(organizationId, input) {
      const c = await db();
      const org = check(await c.from("organizations").select("name").eq("id", organizationId).single()) as Row;
      return toOffer(check(await c.from("partner_offers").insert({ ...offerRow(input), organization_id: organizationId, partner: str(org.name), status: "active" }).select("*").single()) as Row);
    },
    async updateOffer(id, input) {
      const c = await db();
      return toOffer(check(await c.from("partner_offers").update(offerRow(input)).eq("id", id).select("*").single()) as Row);
    },
    async setOfferStatus(id, status) {
      const c = await db();
      return toOffer(check(await c.from("partner_offers").update({ status }).eq("id", id).select("*").single()) as Row);
    },

    async claimOfferCode(offerId) {
      const c = await db();
      const res = await c.rpc("claim_offer_code", { p_offer: offerId });
      if (res.error) return { ok: false, error: sqlMessage(res.error) };
      return { ok: true, code: toCode(res.data as Row) };
    },
    async listCodesForProfile(profileId) {
      const c = await db();
      return (check(await c.from("offer_codes").select("*").eq("profile_id", profileId).order("created_at", { ascending: false })) as Row[]).map(toCode);
    },
    async validateOfferCode(code) {
      const c = await db();
      const res = await c.rpc("validate_offer_code", { p_code: code });
      if (res.error) return { ok: false, error: sqlMessage(res.error) };
      const j = res.data as Row;
      return {
        ok: true,
        validated: {
          code: str(j.code), offerId: str(j.offer_id), offerTitle: str(j.offer_title), badge: str(j.badge), organizationId: strN(j.organization_id),
          firstName: str(j.first_name) || "Membre", premium: j.plan === "premium", createdAt: str(j.created_at), validatedAt: str(j.validated_at),
        },
      };
    },
    async listOrgCodes(organizationId, opts) {
      const c = await db();
      let q = c.from("offer_codes").select("*").eq("organization_id", organizationId);
      if (opts?.validatedOnly) q = q.not("validated_at", "is", null).order("validated_at", { ascending: false });
      else q = q.order("created_at", { ascending: false });
      return (check(await q.limit(opts?.limit ?? 50)) as Row[]).map(toCode);
    },

    async trackOrgEvent(organizationId, kind) {
      const c = await db();
      const res = await c.rpc("track_org_event", { p_org: organizationId, p_kind: kind });
      if (res.error) console.error("[stats]", res.error.message);
    },
    async orgMonthlyStats(organizationId, months) {
      const c = await db();
      const keys = lastMonths(todayYmd(), months);
      const from = `${keys[0]}-01`;
      const [stats, codes] = await Promise.all([
        c.from("org_stats_monthly").select("*").eq("organization_id", organizationId).gte("month", from),
        c.from("offer_code_stats").select("*").eq("organization_id", organizationId).gte("month", from),
      ]);
      const s = check(stats) as Row[];
      const cs = check(codes) as Row[];
      return keys.map((m) => {
        const r = s.find((x) => str(x.month).slice(0, 7) === m);
        const mine = cs.filter((x) => str(x.month).slice(0, 7) === m);
        return {
          ...emptyMonth(m),
          views: num(r?.views), contactClicks: num(r?.contact_clicks), whatsappClicks: num(r?.whatsapp_clicks), directionsClicks: num(r?.directions_clicks),
          codesGenerated: mine.reduce((a, x) => a + num(x.generated), 0),
          codesValidated: mine.reduce((a, x) => a + num(x.validated), 0),
        };
      });
    },
    async offerStats(organizationId) {
      const c = await db();
      const rows = check(await c.from("offer_code_stats").select("*").eq("organization_id", organizationId)) as Row[];
      const by = new Map<string, { offerId: string; generated: number; validated: number }>();
      for (const r of rows) {
        const k = str(r.offer_id);
        const cur = by.get(k) ?? { offerId: k, generated: 0, validated: 0 };
        cur.generated += num(r.generated);
        cur.validated += num(r.validated);
        by.set(k, cur);
      }
      return [...by.values()];
    },

    async getSubscription(organizationId) {
      const c = await db();
      const r = check(await c.from("pro_subscriptions").select("*").eq("organization_id", organizationId).maybeSingle()) as Row | null;
      return r ? toSubscription(r) : null;
    },
    async listSubscriptions() {
      const c = await db();
      return (check(await c.from("pro_subscriptions").select("*")) as Row[]).map(toSubscription);
    },
    async listSubscriptionPayments(organizationId) {
      const c = await db();
      return (check(await c.from("pro_subscription_payments").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })) as Row[]).map(toSubPayment);
    },
    async recordSubscriptionPayment(input) {
      const w = await trusted();
      check(
        await w.from("pro_subscription_payments").insert({
          organization_id: input.organizationId, plan: input.plan, amount: input.amount, status: input.status, method: input.method ?? "simulated" /* Vague 2 */,
          reference: input.reference, period_start: input.periodStart, period_end: input.periodEnd,
        }),
      );
      if (input.status === "paid") {
        check(
          await w.from("pro_subscriptions").upsert({
            organization_id: input.organizationId, plan: input.plan, monthly_price: input.monthlyPrice, status: "active",
            current_period_end: input.periodEnd, cancel_at_period_end: false, updated_at: new Date().toISOString(),
            ...(input.provider ? { provider: input.provider } : {}), // --- Vague 2 ---
          }),
        );
      }
      // --- Vague 2 --- : relu avec le même client (le webhook n'a pas de session)
      const r = check(await w.from("pro_subscriptions").select("*").eq("organization_id", input.organizationId).maybeSingle()) as Row | null;
      if (!r) throw new Error("Paiement refusé : aucun abonnement créé.");
      return toSubscription(r);
    },
    async updateSubscription(organizationId, patch) {
      const w = await trusted();
      const row: Row = { updated_at: new Date().toISOString() };
      if (patch.plan) row.plan = patch.plan;
      if (patch.monthlyPrice !== undefined) row.monthly_price = patch.monthlyPrice;
      if (patch.cancelAtPeriodEnd !== undefined) row.cancel_at_period_end = patch.cancelAtPeriodEnd;
      // --- Vague 2 · paiements --- (synchronisation par le webhook du prestataire)
      if (patch.status) row.status = patch.status;
      if (patch.currentPeriodEnd) row.current_period_end = patch.currentPeriodEnd;
      if (patch.provider) row.provider = patch.provider;
      if (patch.subscriptionRef !== undefined) row.subscription_ref = patch.subscriptionRef;
      if (patch.customerRef !== undefined) row.customer_ref = patch.customerRef;
      return toSubscription(check(await w.from("pro_subscriptions").update(row).eq("organization_id", organizationId).select("*").single()) as Row);
    },
    async refreshSubscriptions() {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 0; // planifiée côté base (pg_cron) en production
      const w = await trusted();
      const res = await w.rpc("refresh_pro_subscriptions");
      return res.error ? 0 : num(res.data);
    },

    async inviteOrgMember(organizationId, email) {
      const c = await db();
      const res = await c.rpc("invite_org_member", { p_org: organizationId, p_email: email });
      if (res.error) return { ok: false, error: sqlMessage(res.error) };
      return { ok: true, joinedProfileId: strN(res.data) };
    },
    async listOrgInvites(organizationId) {
      const c = await db();
      return (check(await c.from("organization_invites").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })) as Row[]).map(toInvite);
    },

    async getMemberLocation(profileId) {
      const c = await db();
      const r = check(await c.from("member_locations").select("*").eq("profile_id", profileId).maybeSingle()) as Row | null;
      return r ? toLocation(r) : null;
    },
    async setMemberLocation(profileId, input) {
      const c = await db();
      // l'arrondi (~500 m) et l'effacement à l'arrêt du partage sont aussi appliqués par le déclencheur SQL
      const r = check(
        await c
          .from("member_locations")
          .upsert({ profile_id: profileId, sharing: input.sharing, precision: input.precision, display: input.display, area: input.area, lat: input.lat, lng: input.lng })
          .select("*")
          .single(),
      ) as Row;
      return toLocation(r);
    },
    async listMemberPins() {
      const c = await db();
      const rows = check(await c.from("member_locations").select("*, profile:profiles(first_name, last_name, job)").eq("sharing", true)) as Row[];
      return rows.flatMap((r): MemberPin[] => {
        const l = toLocation(r);
        if (l.lat == null || l.lng == null) return [];
        const p = r.profile as Row | null;
        const anonymous = l.display === "anonymous" || !p;
        const last = str(p?.last_name);
        return [{ profileId: anonymous ? "" : l.profileId, label: anonymous ? "Une membre" : `${str(p?.first_name)}${last ? " " + last[0] + "." : ""}`, job: anonymous ? null : strN(p?.job), area: l.area, lat: l.lat, lng: l.lng, anonymous }];
      });
    },
  };
}
