// Lot 3 — données d'exemple du module partenaires pour supabase/seed.sql (appelé par scripts/seed-sql.mjs).
// Les organisations, rattachements et rôles ajoutés par le module sont déjà dans s.organizations / s.profiles.
export default function partenairesSql({ s, insert, out, q, uuid, arr }) {
  const p = s.partenaires;
  out("-- Lot 3 : offres complètes, fiches, codes, statistiques, abonnements des pros, invitations, positions (0005_partenaires.sql).");
  insert(
    "partner_offers",
    ["id", "badge", "partner", "detail", "organization_id", "title", "conditions", "valid_from", "valid_until", "audience", "status", "created_at", "sort_order"],
    p.offers.map((o, i) => [q(uuid(o.id)), q(o.badge), q(o.partner), q(o.detail), q(uuid(o.organizationId)), q(o.title), q(o.conditions), q(o.validFrom), q(o.validUntil), q(o.audience), q(o.status), q(o.createdAt), i]),
    "on conflict (id) do update set badge = excluded.badge, partner = excluded.partner, detail = excluded.detail, organization_id = excluded.organization_id, title = excluded.title, conditions = excluded.conditions, valid_from = excluded.valid_from, valid_until = excluded.valid_until, audience = excluded.audience, status = excluded.status, created_at = excluded.created_at",
  );
  insert(
    "establishment_details",
    ["organization_id", "photos", "hours", "whatsapp", "carnet_category", "member_discount", "updated_at"],
    p.details.map((d) => [q(uuid(d.organizationId)), arr(d.photos), q(d.hours), q(d.whatsapp), q(d.carnetCategory), q(d.memberDiscount), q(d.updatedAt)]),
  );
  insert(
    "offer_codes",
    ["id", "offer_id", "organization_id", "profile_id", "code", "created_at", "validated_at", "validated_by"],
    p.offerCodes.map((c) => [q(uuid(c.id)), q(uuid(c.offerId)), q(uuid(c.organizationId)), q(uuid(c.profileId)), q(c.code), q(c.createdAt), q(c.validatedAt), q(uuid(c.validatedBy))]),
  );
  insert(
    "org_stats_monthly",
    ["organization_id", "month", "views", "contact_clicks", "whatsapp_clicks", "directions_clicks"],
    p.stats.map((r) => [q(uuid(r.organizationId)), q(r.month), r.views, r.contactClicks, r.whatsappClicks, r.directionsClicks]),
  );
  insert(
    "pro_subscriptions",
    ["organization_id", "plan", "monthly_price", "status", "started_at", "current_period_end", "cancel_at_period_end", "updated_at"],
    p.subscriptions.map((x) => [q(uuid(x.organizationId)), q(x.plan), x.monthlyPrice, q(x.status), q(x.startedAt), q(x.currentPeriodEnd), q(x.cancelAtPeriodEnd), q(x.updatedAt)]),
  );
  insert(
    "pro_subscription_payments",
    ["id", "organization_id", "plan", "amount", "status", "method", "reference", "period_start", "period_end", "created_at"],
    p.subscriptionPayments.map((x) => [q(uuid(x.id)), q(uuid(x.organizationId)), q(x.plan), x.amount, q(x.status), q(x.method), q(x.reference), q(x.periodStart), q(x.periodEnd), q(x.createdAt)]),
  );
  insert(
    "organization_invites",
    ["id", "organization_id", "email", "invited_by", "created_at", "accepted_at", "accepted_by"],
    p.invites.map((x) => [q(uuid(x.id)), q(uuid(x.organizationId)), q(x.email), q(uuid(x.invitedBy)), q(x.createdAt), q(x.acceptedAt), q(uuid(x.acceptedBy))]),
  );
  insert(
    "member_locations",
    ["profile_id", "sharing", "precision", "display", "area", "lat", "lng", "consented_at"],
    p.locations.map((l) => [q(uuid(l.profileId)), q(l.sharing), q(l.precision), q(l.display), q(l.area), q(l.lat), q(l.lng), q(l.consentedAt)]),
  );
}
