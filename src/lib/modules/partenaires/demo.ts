/**
 * Lot 3 — implémentation « démo » (mémoire) du PartenairesRepo.
 * Reçoit l'accès au jeu de données de demo-repo.ts (pas d'import circulaire).
 */
import { randomUUID } from "node:crypto";
import { nowIso, today } from "../../clock";
import { inCircle, isAdmin } from "../../permissions";
import type { SeedData } from "../../seed";
import type { Organization } from "../../types";
import { blur, effectiveStatus, emptyMonth, lastMonths, offerAvailability, quartier } from "./domain";
import type { PartenairesRepo } from "./repo";
import type { Establishment, EstablishmentDetails, MemberLocation, Offer, OfferCode } from "./types";

const clone = <T>(v: T): T => structuredClone(v);
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function emptyDetails(organizationId: string): EstablishmentDetails {
  return { organizationId, photos: [], hours: null, whatsapp: null, carnetCategory: null, memberDiscount: null, updatedAt: nowIso() };
}

export function partenairesDemo(db: () => SeedData): PartenairesRepo {
  const P = () => db().partenaires;
  const est = (d: SeedData, o: Organization): Establishment => ({ ...o, details: d.partenaires.details.find((x) => x.organizationId === o.id) ?? emptyDetails(o.id) });
  const isMember = (d: SeedData, orgId: string, profileId: string) => d.organizationMembers.some((m) => m.organizationId === orgId && m.profileId === profileId);
  const newCode = (d: SeedData) => {
    for (;;) {
      let s = "OF-";
      for (let i = 0; i < 8; i++) {
        s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        if (i === 3) s += "-";
      }
      if (!d.partenaires.offerCodes.some((c) => c.code === s)) return s;
    }
  };
  const findOffer = (id: string): Offer => {
    const o = P().offers.find((x) => x.id === id);
    if (!o) throw new Error("Offre introuvable.");
    return o;
  };

  return {
    async listEstablishments(opts) {
      const d = db();
      return clone(
        d.organizations
          .filter((o) => (!opts?.kind || o.kinds.includes(opts.kind)) && (!opts?.activeOnly || o.status === "active"))
          .sort((a, b) => a.name.localeCompare(b.name, "fr"))
          .map((o) => est(d, o)),
      );
    },
    async getEstablishment(idOrSlug) {
      const d = db();
      const o = d.organizations.find((x) => x.id === idOrSlug || x.slug === idOrSlug);
      return o ? clone(est(d, o)) : null;
    },
    async updateEstablishment(organizationId, input) {
      const d = db();
      const o = d.organizations.find((x) => x.id === organizationId);
      if (!o) throw new Error("Établissement introuvable.");
      Object.assign(o, {
        description: input.description, address: input.address, area: input.area, lat: input.lat, lng: input.lng,
        phone: input.phone, email: input.email, website: input.website, instagram: input.instagram,
      });
      let det = d.partenaires.details.find((x) => x.organizationId === organizationId);
      if (!det) {
        det = emptyDetails(organizationId);
        d.partenaires.details.push(det);
      }
      Object.assign(det, { photos: input.photos, hours: input.hours, whatsapp: input.whatsapp, carnetCategory: input.carnetCategory, memberDiscount: input.memberDiscount, updatedAt: nowIso() });
      return clone(est(d, o));
    },

    async listOffers(opts) {
      const t = today();
      return clone(
        P()
          .offers.filter((o) => !opts?.organizationId || o.organizationId === opts.organizationId)
          .filter((o) => !opts?.activeOnly || (o.status === "active" && (!o.validUntil || o.validUntil >= t)))
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      );
    },
    async getOffer(id) {
      const o = P().offers.find((x) => x.id === id);
      return o ? clone(o) : null;
    },
    async createOffer(organizationId, input) {
      const d = db();
      const org = d.organizations.find((x) => x.id === organizationId);
      if (!org) throw new Error("Établissement introuvable.");
      const o: Offer = { id: randomUUID(), organizationId, partner: org.name, status: "active", createdAt: nowIso(), ...input };
      d.partenaires.offers.push(o);
      return clone(o);
    },
    async updateOffer(id, input) {
      const o = findOffer(id);
      Object.assign(o, input);
      return clone(o);
    },
    async setOfferStatus(id, status) {
      const o = findOffer(id);
      o.status = status;
      return clone(o);
    },

    async claimOfferCode(offerId, profileId) {
      const d = db();
      const o = d.partenaires.offers.find((x) => x.id === offerId);
      const p = d.profiles.find((x) => x.id === profileId);
      if (!o) return { ok: false, error: "Cette offre n’est plus disponible." };
      if (!p || !inCircle(p)) return { ok: false, error: "Réservé aux membres du club." };
      const av = offerAvailability(o, p.plan, today(), isAdmin(p));
      if (!av.ok) return { ok: false, error: av.reason };
      const open = d.partenaires.offerCodes.find((c) => c.offerId === offerId && c.profileId === profileId && !c.validatedAt);
      if (open) return { ok: true, code: clone(open) };
      const c: OfferCode = { id: randomUUID(), offerId, organizationId: o.organizationId, profileId, code: newCode(d), createdAt: nowIso(), validatedAt: null, validatedBy: null };
      d.partenaires.offerCodes.push(c);
      return { ok: true, code: clone(c) };
    },
    async listCodesForProfile(profileId) {
      return clone(P().offerCodes.filter((c) => c.profileId === profileId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    },
    async validateOfferCode(code, actorId, organizationIds) {
      const d = db();
      const c = d.partenaires.offerCodes.find((x) => x.code === code);
      if (!c) return { ok: false, error: "Code inconnu." };
      if (organizationIds !== "all" && (!c.organizationId || !organizationIds.includes(c.organizationId))) return { ok: false, error: "Ce code ne concerne pas ton établissement." };
      if (c.validatedAt) return { ok: false, error: `Code déjà utilisé le ${new Date(c.validatedAt).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", dateStyle: "short", timeStyle: "short" })}.` };
      c.validatedAt = nowIso();
      c.validatedBy = actorId;
      const o = d.partenaires.offers.find((x) => x.id === c.offerId);
      const p = d.profiles.find((x) => x.id === c.profileId);
      return {
        ok: true,
        validated: {
          code: c.code, offerId: c.offerId, offerTitle: o?.title ?? o?.detail ?? "Offre", badge: o?.badge ?? "", organizationId: c.organizationId,
          firstName: p?.firstName ?? "Membre", premium: p?.plan === "premium", createdAt: c.createdAt, validatedAt: c.validatedAt,
        },
      };
    },
    async listOrgCodes(organizationId, opts) {
      return clone(
        P()
          .offerCodes.filter((c) => c.organizationId === organizationId && (!opts?.validatedOnly || c.validatedAt))
          .sort((a, b) => ((a.validatedAt ?? a.createdAt) < (b.validatedAt ?? b.createdAt) ? 1 : -1))
          .slice(0, opts?.limit ?? 50),
      );
    },

    async trackOrgEvent(organizationId, kind, profileId) {
      const d = db();
      if (isMember(d, organizationId, profileId)) return;
      const month = today().slice(0, 7) + "-01";
      let row = d.partenaires.stats.find((s) => s.organizationId === organizationId && s.month === month);
      if (!row) {
        row = { organizationId, month, views: 0, contactClicks: 0, whatsappClicks: 0, directionsClicks: 0 };
        d.partenaires.stats.push(row);
      }
      if (kind === "view") row.views++;
      else if (kind === "contact") row.contactClicks++;
      else if (kind === "whatsapp") row.whatsappClicks++;
      else row.directionsClicks++;
    },
    async orgMonthlyStats(organizationId, months) {
      const d = db();
      return lastMonths(today(), months).map((m) => {
        const s = d.partenaires.stats.find((x) => x.organizationId === organizationId && x.month.slice(0, 7) === m);
        const codes = d.partenaires.offerCodes.filter((c) => c.organizationId === organizationId && c.createdAt.slice(0, 7) === m);
        return {
          ...emptyMonth(m),
          ...(s ? { views: s.views, contactClicks: s.contactClicks, whatsappClicks: s.whatsappClicks, directionsClicks: s.directionsClicks } : {}),
          codesGenerated: codes.length,
          codesValidated: codes.filter((c) => c.validatedAt).length,
        };
      });
    },
    async offerStats(organizationId) {
      const codes = P().offerCodes.filter((c) => c.organizationId === organizationId);
      const ids = [...new Set(codes.map((c) => c.offerId))];
      return ids.map((offerId) => {
        const mine = codes.filter((c) => c.offerId === offerId);
        return { offerId, generated: mine.length, validated: mine.filter((c) => c.validatedAt).length };
      });
    },

    async getSubscription(organizationId) {
      const s = P().subscriptions.find((x) => x.organizationId === organizationId);
      return s ? clone(s) : null;
    },
    async listSubscriptions() {
      return clone(P().subscriptions);
    },
    async listSubscriptionPayments(organizationId) {
      return clone(P().subscriptionPayments.filter((p) => p.organizationId === organizationId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    },
    async recordSubscriptionPayment(input) {
      const d = db();
      d.partenaires.subscriptionPayments.push({
        id: randomUUID(), organizationId: input.organizationId, plan: input.plan, amount: input.amount, status: input.status, method: input.method ?? "simulated" /* Vague 2 */,
        reference: input.reference, periodStart: input.periodStart, periodEnd: input.periodEnd, createdAt: nowIso(),
      });
      let s = d.partenaires.subscriptions.find((x) => x.organizationId === input.organizationId);
      if (input.status === "paid") {
        if (!s) {
          s = { organizationId: input.organizationId, plan: input.plan, monthlyPrice: input.monthlyPrice, status: "active", startedAt: input.periodStart, currentPeriodEnd: input.periodEnd, cancelAtPeriodEnd: false, updatedAt: nowIso() };
          d.partenaires.subscriptions.push(s);
        } else {
          Object.assign(s, { plan: input.plan, monthlyPrice: input.monthlyPrice, status: "active", currentPeriodEnd: input.periodEnd, cancelAtPeriodEnd: false, updatedAt: nowIso() });
        }
      } else if (s) {
        s.status = effectiveStatus(s, today());
        s.updatedAt = nowIso();
      }
      if (!s) throw new Error("Paiement refusé : aucun abonnement créé.");
      return clone(s);
    },
    async updateSubscription(organizationId, patch) {
      const s = P().subscriptions.find((x) => x.organizationId === organizationId);
      if (!s) throw new Error("Aucun abonnement pour cet établissement.");
      if (patch.plan) s.plan = patch.plan;
      if (patch.monthlyPrice !== undefined) s.monthlyPrice = patch.monthlyPrice;
      if (patch.cancelAtPeriodEnd !== undefined) s.cancelAtPeriodEnd = patch.cancelAtPeriodEnd;
      // --- Vague 2 · paiements --- (synchronisation par le webhook du prestataire)
      if (patch.status) s.status = patch.status;
      if (patch.currentPeriodEnd) s.currentPeriodEnd = patch.currentPeriodEnd;
      if (patch.provider) s.provider = patch.provider;
      if (patch.subscriptionRef !== undefined) s.subscriptionRef = patch.subscriptionRef;
      if (patch.customerRef !== undefined) s.customerRef = patch.customerRef;
      s.updatedAt = nowIso();
      return clone(s);
    },
    async refreshSubscriptions(todayYmd) {
      let n = 0;
      for (const s of P().subscriptions) {
        const st = effectiveStatus(s, todayYmd);
        if (st !== s.status) {
          s.status = st;
          s.updatedAt = nowIso();
          n++;
        }
      }
      return n;
    },

    async inviteOrgMember(organizationId, email, actorId) {
      const d = db();
      const org = d.organizations.find((o) => o.id === organizationId);
      if (!org) return { ok: false, error: "Établissement introuvable." };
      const mail = email.trim().toLowerCase();
      const p = d.profiles.find((x) => x.email?.toLowerCase() === mail);
      if (p) {
        if (isMember(d, organizationId, p.id)) return { ok: false, error: "Cette personne fait déjà partie de l’équipe." };
        d.organizationMembers.push({ organizationId, profileId: p.id, role: "staff", createdAt: nowIso() });
        for (const k of org.kinds) if (!p.roles.includes(k)) p.roles = [...p.roles, k];
        d.partenaires.invites.push({ id: randomUUID(), organizationId, email: mail, invitedBy: actorId, createdAt: nowIso(), acceptedAt: nowIso(), acceptedBy: p.id });
        return { ok: true, joinedProfileId: p.id };
      }
      if (d.partenaires.invites.some((i) => i.organizationId === organizationId && i.email === mail && !i.acceptedAt)) return { ok: false, error: "Une invitation attend déjà cette adresse." };
      d.partenaires.invites.push({ id: randomUUID(), organizationId, email: mail, invitedBy: actorId, createdAt: nowIso(), acceptedAt: null, acceptedBy: null });
      return { ok: true, joinedProfileId: null };
    },
    async listOrgInvites(organizationId) {
      return clone(P().invites.filter((i) => i.organizationId === organizationId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    },

    async getMemberLocation(profileId) {
      const l = P().locations.find((x) => x.profileId === profileId);
      return l ? clone(l) : null;
    },
    async setMemberLocation(profileId, input) {
      const d = db();
      let l = d.partenaires.locations.find((x) => x.profileId === profileId);
      if (!l) {
        l = { profileId, sharing: false, precision: "area", display: "name", area: null, lat: null, lng: null, consentedAt: null, updatedAt: nowIso() };
        d.partenaires.locations.push(l);
      }
      const next: MemberLocation = { ...l, ...input, updatedAt: nowIso() };
      // Mêmes règles que le déclencheur SQL : jamais de position exacte, tout s'efface à l'arrêt du partage.
      if (!next.sharing) Object.assign(next, { lat: null, lng: null, area: null, consentedAt: null });
      else {
        const q = quartier(next.area);
        if (next.precision === "area" && q) Object.assign(next, { lat: q.lat, lng: q.lng });
        if (next.lat == null || next.lng == null) throw new Error("Choisis ton quartier pour apparaître sur la carte.");
        next.lat = blur(next.lat);
        next.lng = blur(next.lng);
        next.consentedAt = l.consentedAt ?? nowIso();
      }
      Object.assign(l, next);
      return clone(l);
    },
    async listMemberPins() {
      const d = db();
      return d.partenaires.locations
        .filter((l) => l.sharing && l.lat != null && l.lng != null)
        .flatMap((l) => {
          const p = d.profiles.find((x) => x.id === l.profileId);
          if (!p || !inCircle(p)) return [];
          const anonymous = l.display === "anonymous";
          return [{ profileId: anonymous ? "" : p.id, label: anonymous ? "Une membre" : `${p.firstName}${p.lastName ? " " + p.lastName[0] + "." : ""}`, job: anonymous ? null : p.job, area: l.area, lat: l.lat!, lng: l.lng!, anonymous }];
        });
    },
  };
}
