-- =====================================================================
-- Nomad Club : Lot 3 — partenaires, carnet pro et carte
-- Fiches établissements complètes, offres partenaires (code / QR personnel, validation),
-- statistiques mensuelles, abonnement des pros du carnet (paiement simulé côté appli),
-- invitations d'équipe et positions APPROXIMATIVES des membres qui ont consenti.
-- Ne dépend que de 0001 → 0003. Peut s'appliquer avant ou après les migrations des autres lots.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fiche établissement : compléments (photos, horaires, WhatsApp, réduction pro…)
-- ---------------------------------------------------------------------
create table public.establishment_details (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  photos text[] not null default '{}' check (cardinality(photos) <= 8),
  hours text check (length(hours) <= 400),
  whatsapp text,
  -- Catégorie du carnet (mêmes clés que places.categories) pour le filtre du carnet et de la carte.
  carnet_category text check (carnet_category in ('manger', 'sortir', 'bien-etre-sport', 'famille', 'hotels-piscines', 'beaute', 'sante', 'urgences', 'shopping', 'pratique')),
  -- Réduction optionnelle d'une pro du carnet pour les membres (texte libre : « -10 % sur la 1re séance »).
  member_discount text check (length(member_discount) <= 160),
  updated_at timestamptz not null default now()
);

alter table public.establishment_details enable row level security;

-- Lecture : l'équipe de l'établissement, les administratrices, et le cercle pour les établissements actifs.
create policy establishment_details_select on public.establishment_details for select to authenticated using (
  public.has_role('admin')
  or public.is_org_member(organization_id)
  or (
    public.has_any_role(array['member', 'moderator', 'admin'])
    and exists (select 1 from public.organizations o where o.id = organization_id and o.status = 'active')
  )
);
-- Écriture : l'équipe (propriétaire et collaboratrices) et les administratrices.
create policy establishment_details_team_write on public.establishment_details for all to authenticated
  using (public.is_org_member(organization_id) or public.has_role('admin'))
  with check (public.is_org_member(organization_id) or public.has_role('admin'));

-- Les collaboratrices (staff) modifient aussi la fiche de l'établissement (0003 ne l'ouvrait qu'à la propriétaire).
create policy organizations_staff_update on public.organizations for update to authenticated
  using (public.is_org_member(id, array['staff'])) with check (public.is_org_member(id, array['staff']));

-- ---------------------------------------------------------------------
-- 2. Offres partenaires : détails, public visé, validité, pause
-- ---------------------------------------------------------------------
alter table public.partner_offers
  add column if not exists title text,
  add column if not exists conditions text,
  add column if not exists valid_from date,
  add column if not exists valid_until date,
  add column if not exists audience text not null default 'all',
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now();
alter table public.partner_offers add constraint partner_offers_audience_check check (audience in ('all', 'member', 'premium'));
alter table public.partner_offers add constraint partner_offers_status_check check (status in ('active', 'paused'));
alter table public.partner_offers add constraint partner_offers_validity_check check (valid_until is null or valid_from is null or valid_until >= valid_from);

-- Les membres ne voient que les offres actives ; l'équipe de l'établissement voit et gère les siennes.
drop policy if exists offers_members on public.partner_offers;
create policy offers_members on public.partner_offers for select using (
  public.has_any_role(array['member', 'moderator', 'admin'])
  and (status = 'active' or public.has_role('admin'))
);
create policy offers_team_select on public.partner_offers for select to authenticated using (
  organization_id is not null and public.is_org_member(organization_id)
);
create policy offers_team_write on public.partner_offers for all to authenticated
  using (organization_id is not null and public.is_org_member(organization_id))
  with check (organization_id is not null and public.is_org_member(organization_id));

-- ---------------------------------------------------------------------
-- 3. Codes personnels d'utilisation (un code ouvert par membre et par offre, horodaté)
-- ---------------------------------------------------------------------
create table public.offer_codes (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.partner_offers (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^OF-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  validated_by uuid references public.profiles (id) on delete set null
);
-- Un seul code « ouvert » (non encore validé) par membre et par offre.
create unique index offer_codes_open_idx on public.offer_codes (offer_id, profile_id) where validated_at is null;
create index offer_codes_org_idx on public.offer_codes (organization_id, created_at);

alter table public.offer_codes enable row level security;
-- La membre voit ses codes ; l'équipe de l'établissement voit les codes de ses offres ; l'admin voit tout.
create policy offer_codes_select on public.offer_codes for select to authenticated using (
  profile_id = auth.uid() or public.has_role('admin') or (organization_id is not null and public.is_org_member(organization_id))
);
-- Aucune écriture directe : uniquement par claim_offer_code() et validate_offer_code().
revoke insert, update, delete on public.offer_codes from anon, authenticated;

-- Code lisible au comptoir : OF-XXXX-XXXX (sans 0/O ni 1/I).
create or replace function public.new_offer_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  out text;
begin
  loop
    out := 'OF-';
    for i in 1..8 loop
      out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      if i = 4 then out := out || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.offer_codes where code = out);
  end loop;
  return out;
end $$;

-- « Utiliser l'offre » : renvoie le code ouvert de la membre pour cette offre, ou en crée un.
-- Vérifie : membre du cercle, offre active et dans sa période, public visé (Premium).
create or replace function public.claim_offer_code(p_offer uuid) returns public.offer_codes
language plpgsql security definer set search_path = public as $$
declare
  o public.partner_offers;
  c public.offer_codes;
  my_plan text;
begin
  if auth.uid() is null or not public.has_any_role(array['member', 'moderator', 'admin']) then
    raise exception 'Réservé aux membres du club.';
  end if;
  select * into o from public.partner_offers where id = p_offer;
  if not found or o.status <> 'active' then raise exception 'Cette offre n''est plus disponible.'; end if;
  if (o.valid_from is not null and o.valid_from > current_date) or (o.valid_until is not null and o.valid_until < current_date) then
    raise exception 'Cette offre n''est pas valable aujourd''hui.';
  end if;
  select plan into my_plan from public.profiles where id = auth.uid();
  if o.audience = 'premium' and coalesce(my_plan, 'free') <> 'premium' and not public.has_role('admin') then
    raise exception 'Offre réservée aux membres Premium.';
  end if;
  select * into c from public.offer_codes where offer_id = p_offer and profile_id = auth.uid() and validated_at is null;
  if found then return c; end if;
  insert into public.offer_codes (offer_id, organization_id, profile_id, code)
  values (p_offer, o.organization_id, auth.uid(), public.new_offer_code())
  returning * into c;
  return c;
end $$;

-- Validation au comptoir par l'équipe de l'établissement (saisie ou scan du code).
-- Renvoie le code validé, l'offre et le prénom de la membre (jamais ses coordonnées).
create or replace function public.validate_offer_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.offer_codes;
  o public.partner_offers;
  who record;
begin
  select * into c from public.offer_codes where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Code inconnu.'; end if;
  if not (public.has_role('admin') or (c.organization_id is not null and public.is_org_member(c.organization_id))) then
    raise exception 'Ce code ne concerne pas ton établissement.';
  end if;
  if c.validated_at is not null then raise exception 'Code déjà utilisé le %.', to_char(c.validated_at at time zone 'Africa/Casablanca', 'DD/MM/YYYY à HH24:MI'); end if;
  select * into o from public.partner_offers where id = c.offer_id;
  update public.offer_codes set validated_at = now(), validated_by = auth.uid() where id = c.id returning * into c;
  select first_name, plan into who from public.profiles where id = c.profile_id;
  return jsonb_build_object(
    'id', c.id, 'code', c.code, 'offer_id', c.offer_id, 'offer_title', coalesce(o.title, o.detail), 'badge', o.badge,
    'organization_id', c.organization_id, 'profile_id', c.profile_id, 'first_name', who.first_name, 'plan', who.plan,
    'created_at', c.created_at, 'validated_at', c.validated_at
  );
end $$;

revoke all on function public.new_offer_code() from public, anon, authenticated;
revoke all on function public.claim_offer_code(uuid) from public, anon;
revoke all on function public.validate_offer_code(text) from public, anon;
grant execute on function public.claim_offer_code(uuid) to authenticated, service_role;
grant execute on function public.validate_offer_code(text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Statistiques mensuelles (vues de fiche, clics contact / WhatsApp / itinéraire)
-- ---------------------------------------------------------------------
create table public.org_stats_monthly (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  views integer not null default 0 check (views >= 0),
  contact_clicks integer not null default 0 check (contact_clicks >= 0),
  whatsapp_clicks integer not null default 0 check (whatsapp_clicks >= 0),
  directions_clicks integer not null default 0 check (directions_clicks >= 0),
  primary key (organization_id, month)
);
alter table public.org_stats_monthly enable row level security;
-- Un établissement ne voit que SES statistiques ; l'admin voit tout.
create policy org_stats_select on public.org_stats_monthly for select to authenticated using (
  public.has_role('admin') or public.is_org_member(organization_id)
);
revoke insert, update, delete on public.org_stats_monthly from anon, authenticated;

-- Compte une vue ou un clic (appelée par l'appli quand une membre ouvre une fiche ou un lien de contact).
create or replace function public.track_org_event(p_org uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', (now() at time zone 'Africa/Casablanca'))::date;
begin
  if auth.uid() is null or not public.has_any_role(array['member', 'moderator', 'admin']) then return; end if;
  if public.is_org_member(p_org) then return; end if; -- l'établissement ne gonfle pas ses propres chiffres
  if p_kind not in ('view', 'contact', 'whatsapp', 'directions') then raise exception 'Type de statistique inconnu.'; end if;
  insert into public.org_stats_monthly (organization_id, month, views, contact_clicks, whatsapp_clicks, directions_clicks)
  values (p_org, m, (p_kind = 'view')::int, (p_kind = 'contact')::int, (p_kind = 'whatsapp')::int, (p_kind = 'directions')::int)
  on conflict (organization_id, month) do update set
    views = org_stats_monthly.views + excluded.views,
    contact_clicks = org_stats_monthly.contact_clicks + excluded.contact_clicks,
    whatsapp_clicks = org_stats_monthly.whatsapp_clicks + excluded.whatsapp_clicks,
    directions_clicks = org_stats_monthly.directions_clicks + excluded.directions_clicks;
end $$;
revoke all on function public.track_org_event(uuid, text) from public, anon;
grant execute on function public.track_org_event(uuid, text) to authenticated, service_role;

-- Codes générés / validés par mois (lecture soumise à la RLS de offer_codes : chacun ne voit que les siens).
create view public.offer_code_stats with (security_invoker = true) as
  select organization_id, offer_id,
         date_trunc('month', created_at at time zone 'Africa/Casablanca')::date as month,
         count(*)::int as generated,
         count(validated_at)::int as validated
    from public.offer_codes
   group by 1, 2, 3;

-- ---------------------------------------------------------------------
-- 5. Abonnement mensuel des pros du carnet
-- ---------------------------------------------------------------------
create table public.pro_subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  plan text not null check (plan in ('essentiel', 'visibilite', 'vitrine')),
  monthly_price numeric(10, 2) not null check (monthly_price >= 0),
  status text not null default 'active' check (status in ('active', 'past_due', 'suspended', 'cancelled')),
  started_at date not null default current_date,
  current_period_end date not null,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.pro_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  status text not null check (status in ('paid', 'failed')),
  method text not null default 'simulated' check (method in ('simulated', 'card', 'transfer')),
  reference text not null,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now()
);
create index pro_subscription_payments_org_idx on public.pro_subscription_payments (organization_id, created_at desc);

alter table public.pro_subscriptions enable row level security;
alter table public.pro_subscription_payments enable row level security;
-- L'équipe voit son abonnement et ses paiements ; le cercle sait seulement quelles fiches sont visibles (abonnement actif).
create policy pro_subscriptions_select on public.pro_subscriptions for select to authenticated using (
  public.has_role('admin')
  or public.is_org_member(organization_id)
  or (status = 'active' and current_period_end >= current_date and public.has_any_role(array['member', 'moderator']))
);
create policy pro_subscriptions_admin on public.pro_subscriptions for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy pro_subscription_payments_select on public.pro_subscription_payments for select to authenticated using (
  public.has_role('admin') or public.is_org_member(organization_id)
);
create policy pro_subscription_payments_admin on public.pro_subscription_payments for all using (public.has_role('admin')) with check (public.has_role('admin'));
-- Les paiements (simulés aujourd'hui, réels au Lot 2) sont écrits par le serveur avec la clé service.

-- Passe en retard les abonnements échus, puis suspend après 15 jours (à planifier chaque nuit, ex. pg_cron).
create or replace function public.refresh_pro_subscriptions() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.pro_subscriptions set
    status = case
      when cancel_at_period_end then 'cancelled'
      when current_period_end < current_date - 15 then 'suspended'
      else 'past_due' end,
    updated_at = now()
   where status in ('active', 'past_due') and current_period_end < current_date;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.refresh_pro_subscriptions() from public, anon, authenticated;
grant execute on function public.refresh_pro_subscriptions() to service_role;

-- ---------------------------------------------------------------------
-- 6. Équipe : invitations de collaboratrices par la propriétaire
-- ---------------------------------------------------------------------
create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null
);
create unique index organization_invites_open_idx on public.organization_invites (organization_id, lower(email)) where accepted_at is null;
alter table public.organization_invites enable row level security;
create policy organization_invites_select on public.organization_invites for select to authenticated using (
  public.has_role('admin') or public.is_org_member(organization_id)
);
revoke insert, update, delete on public.organization_invites from anon, authenticated;

-- Rattache une personne à un établissement (rôle staff) et lui ouvre l'espace correspondant.
create or replace function public.join_organization(p_org uuid, p_profile uuid, p_by uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  insert into public.organization_members (organization_id, profile_id, role) values (p_org, p_profile, 'staff') on conflict do nothing;
  for k in select unnest(kinds) from public.organizations where id = p_org loop
    insert into public.user_roles (profile_id, role, granted_by) values (p_profile, k, p_by) on conflict do nothing;
  end loop;
end $$;
revoke all on function public.join_organization(uuid, uuid, uuid) from public, anon, authenticated;

-- Invitation par e-mail : si un compte existe déjà, il rejoint l'équipe tout de suite ;
-- sinon l'invitation attend et sera acceptée à la création du compte (déclencheur ci-dessous).
-- Renvoie le profil rattaché (ou null si l'invitation attend).
create or replace function public.invite_org_member(p_org uuid, p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  mail text := lower(trim(p_email));
begin
  if not (public.is_org_member(p_org, array['owner']) or public.has_role('admin')) then
    raise exception 'Seule la propriétaire de l''établissement invite son équipe.';
  end if;
  select id into target from public.profiles where lower(email) = mail limit 1;
  if target is not null then
    if exists (select 1 from public.organization_members where organization_id = p_org and profile_id = target) then
      raise exception 'Cette personne fait déjà partie de l''équipe.';
    end if;
    perform public.join_organization(p_org, target, auth.uid());
    insert into public.organization_invites (organization_id, email, invited_by, accepted_at, accepted_by) values (p_org, mail, auth.uid(), now(), target);
    return target;
  end if;
  insert into public.organization_invites (organization_id, email, invited_by) values (p_org, mail, auth.uid())
  on conflict (organization_id, lower(email)) where accepted_at is null do nothing;
  return null;
end $$;
revoke all on function public.invite_org_member(uuid, text) from public, anon;
grant execute on function public.invite_org_member(uuid, text) to authenticated, service_role;

create or replace function public.accept_org_invites() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  if new.email is null then return new; end if;
  for inv in select * from public.organization_invites where accepted_at is null and lower(email) = lower(new.email) loop
    perform public.join_organization(inv.organization_id, new.id, inv.invited_by);
    update public.organization_invites set accepted_at = now(), accepted_by = new.id where id = inv.id;
  end loop;
  return new;
end $$;
create trigger profiles_accept_org_invites after insert or update of email on public.profiles
  for each row execute function public.accept_org_invites();

-- ---------------------------------------------------------------------
-- 7. Carte : position APPROXIMATIVE des membres qui ont consenti
-- ---------------------------------------------------------------------
create table public.member_locations (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  sharing boolean not null default false,
  -- area : seulement le quartier (point au centre du quartier) ; approx : point arrondi à ~500 m.
  precision text not null default 'area' check (precision in ('area', 'approx')),
  -- name : prénom et métier ; anonymous : « une membre » sans nom.
  display text not null default 'name' check (display in ('name', 'anonymous')),
  area text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  consented_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint member_locations_coords check ((lat is null) = (lng is null)),
  constraint member_locations_consent check (not sharing or (consented_at is not null and lat is not null))
);

-- Jamais de position exacte en base : arrondi à 0,005° (~550 m) ; tout est effacé quand le partage s'arrête.
create or replace function public.blur_member_location() returns trigger
language plpgsql set search_path = public as $$
begin
  if not new.sharing then
    new.lat := null; new.lng := null; new.area := null; new.consented_at := null;
  else
    new.lat := round((new.lat / 0.005)::numeric) * 0.005;
    new.lng := round((new.lng / 0.005)::numeric) * 0.005;
    if new.consented_at is null then new.consented_at := now(); end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger member_locations_blur before insert or update on public.member_locations
  for each row execute function public.blur_member_location();

alter table public.member_locations enable row level security;
-- Chacune gère sa ligne ; le cercle ne voit QUE les positions partagées (même une admin ne voit pas les autres).
create policy member_locations_own on public.member_locations for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy member_locations_shared on public.member_locations for select to authenticated using (
  sharing and public.has_any_role(array['member', 'moderator', 'admin'])
);

-- ---------------------------------------------------------------------
-- 8. Journal : l'équipe d'un établissement journalise ses propres opérations
-- ---------------------------------------------------------------------
create policy audit_log_insert_org on public.audit_log for insert to authenticated with check (
  actor_id = auth.uid() and target_type = 'organization' and target_id is not null and public.is_org_member(target_id)
);
