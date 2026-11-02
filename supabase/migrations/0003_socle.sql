-- =====================================================================
-- Nomad Club : socle (Lot 0)
-- Rôles cumulables, organisations (partenaires et pros), journal des opérations,
-- notifications in-app et préférences. Les politiques RLS qui s'appuyaient sur le rôle unique
-- (profiles.role, is_founder(), is_member()) passent aux nouveaux rôles.
-- À exécuter APRÈS 0001_init.sql et 0002_carnet_annuaire.sql.
-- (Numérotée 0003 : le préfixe 0002 est déjà pris par le carnet d'adresses.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rôles cumulables
-- ---------------------------------------------------------------------
create table public.user_roles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('member', 'moderator', 'admin', 'partner', 'pro')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (profile_id, role)
);
create index user_roles_role_idx on public.user_roles (role);

-- Reprise du rôle unique : « founder » devient « admin », « member » reste « member » ;
-- « guest » = aucune ligne.
insert into public.user_roles (profile_id, role)
select id, case role when 'founder' then 'admin' else role end
  from public.profiles
 where role in ('member', 'founder')
on conflict do nothing;

-- La personne connectée a-t-elle ce rôle ? (security definer : utilisable dans les politiques RLS sans récursion)
create or replace function public.has_role(p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where profile_id = auth.uid() and role = p_role);
$$;

create or replace function public.has_any_role(p_roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where profile_id = auth.uid() and role = any (p_roles));
$$;

-- Une autre personne a-t-elle l'un de ces rôles ? (annuaire, vues des fondatrices)
-- Réservée aux personnes connectées : les politiques qui l'utilisent sont « to authenticated ».
create or replace function public.user_has_any_role(p_user uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where profile_id = p_user and role = any (p_roles));
$$;

revoke all on function public.has_role(text) from public;
revoke all on function public.has_any_role(text[]) from public;
revoke all on function public.user_has_any_role(uuid, text[]) from public, anon;
grant execute on function public.has_role(text) to anon, authenticated, service_role;
grant execute on function public.has_any_role(text[]) to anon, authenticated, service_role;
grant execute on function public.user_has_any_role(uuid, text[]) to authenticated, service_role;

-- On ne retire jamais la dernière administratrice (sinon plus personne ne peut gérer l'appli).
create or replace function public.keep_one_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and not exists (select 1 from public.user_roles where role = 'admin' and profile_id <> old.profile_id) then
    raise exception 'last_admin';
  end if;
  return old;
end $$;
create trigger user_roles_keep_admin before delete on public.user_roles for each row execute function public.keep_one_admin();

-- ---------------------------------------------------------------------
-- 2. Fin du rôle unique : vues et politiques qui en dépendaient
-- ---------------------------------------------------------------------
drop view if exists public.founder_actions;
drop view if exists public.dues_by_month;

drop policy if exists profiles_select_directory on public.profiles;
drop policy if exists profiles_founders on public.profiles;
drop policy if exists places_members on public.places;
drop policy if exists places_founders on public.places;
drop policy if exists offers_members on public.partner_offers;
drop policy if exists offers_founders on public.partner_offers;
drop policy if exists events_founders on public.events;
drop policy if exists memories_founders on public.memories;
drop policy if exists bookings_founders on public.bookings;
drop policy if exists payments_founders on public.payments;
drop policy if exists memberships_founders on public.memberships;
drop policy if exists messages_read on public.messages;
drop policy if exists messages_write on public.messages;
drop policy if exists messages_founders on public.messages;
drop policy if exists reminders_founders on public.reminders;

alter table public.profiles drop column role;

-- Une adhérente ne peut pas modifier elle-même sa formule, son échéance ou sa carte.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('nc.trusted', true), '') = 'on' or auth.role() = 'service_role' or public.has_role('admin') then
    return new;
  end if;
  if new.plan is distinct from old.plan or new.plan_ends_at is distinct from old.plan_ends_at or new.card_number is distinct from old.card_number then
    raise exception 'Modification réservée aux fondatrices.';
  end if;
  return new;
end $$;

-- Effet d'une adhésion payée : formule, échéance, carte, et rôle « member » (les administratrices gardent le leur).
create or replace function public.apply_membership(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments;
  me public.profiles;
  v_start date;
  v_end date;
  v_plan text;
begin
  select * into pay from public.payments where id = p_payment;
  if pay.kind <> 'membership' or pay.profile_id is null then return; end if;
  select * into me from public.profiles where id = pay.profile_id for update;
  v_plan := pay.plan;
  if pay.membership_action = 'upgrade' then
    v_start := current_date;
    v_end := case when me.plan_ends_at >= current_date then me.plan_ends_at else current_date + interval '1 year' end;
    v_plan := 'premium';
  elsif pay.membership_action = 'renew' and me.plan_ends_at >= current_date then
    v_start := me.plan_ends_at;
    v_end := me.plan_ends_at + interval '1 year';
  else
    v_start := current_date;
    v_end := current_date + interval '1 year';
  end if;
  perform set_config('nc.trusted', 'on', true);
  update public.profiles
     set plan = v_plan,
         plan_ends_at = v_end,
         card_number = coalesce(card_number, 'NC ' || lpad(nextval('public.card_number_seq')::text, 4, '0'))
   where id = me.id;
  if not public.user_has_any_role(me.id, array['admin']) then
    insert into public.user_roles (profile_id, role, granted_by) values (me.id, 'member', pay.validated_by) on conflict do nothing;
  end if;
  update public.memberships set status = 'expired' where profile_id = me.id and status = 'active' and ends_at <= v_start;
  insert into public.memberships (profile_id, plan, starts_at, ends_at, status) values (me.id, v_plan, v_start, v_end, 'active');
  perform set_config('nc.trusted', 'off', true);
end $$;
revoke all on function public.apply_membership(uuid) from public, anon, authenticated;

-- Valider un virement (administratrices).
create or replace function public.validate_payment(p_payment uuid) returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments;
begin
  if not public.has_role('admin') then raise exception 'admin_only'; end if;
  update public.payments set status = 'validated', validated_at = now(), validated_by = auth.uid()
   where id = p_payment and status = 'declared'
  returning * into pay;
  if not found then return null; end if;
  if pay.kind = 'booking' and pay.booking_id is not null then
    update public.bookings set status = 'paid' where id = pay.booking_id and status = 'pending';
  end if;
  perform public.apply_membership(pay.id);
  return pay;
end $$;

-- Annuler sa réservation. Renvoie le rendez-vous et, si une place s'est libérée,
-- la première personne (avec compte) de la liste d'attente, à prévenir.
drop function if exists public.cancel_booking(uuid);
create function public.cancel_booking(p_booking uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  v_next uuid;
begin
  select * into b from public.bookings
   where id = p_booking and profile_id = auth.uid() and status <> 'cancelled'
   for update;
  if not found then
    return json_build_object('event_id', null, 'waitlist_profile_id', null);
  end if;
  update public.bookings set status = 'cancelled' where id = b.id;
  if b.status <> 'waitlist' then
    select profile_id into v_next from public.bookings
     where event_id = b.event_id and status = 'waitlist' and profile_id is not null
     order by created_at limit 1;
  end if;
  return json_build_object('event_id', b.event_id, 'waitlist_profile_id', v_next);
end $$;
revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- Anciennes fonctions du rôle unique : plus rien ne s'en sert.
drop function if exists public.is_founder();
drop function if exists public.is_member();

-- ---------------------------------------------------------------------
-- 3. Politiques RLS existantes, réécrites avec les rôles
--    cercle = member, moderator, admin (annuaire, salon, carnet)
-- ---------------------------------------------------------------------
create policy profiles_select_directory on public.profiles for select to authenticated using (
  public.has_any_role(array['member', 'moderator', 'admin']) and public.user_has_any_role(id, array['member', 'moderator', 'admin'])
);
create policy profiles_admin on public.profiles for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy places_members on public.places for select using (public.has_any_role(array['member', 'moderator', 'admin']));
create policy places_admin on public.places for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy offers_members on public.partner_offers for select using (public.has_any_role(array['member', 'moderator', 'admin']));
create policy offers_admin on public.partner_offers for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy events_admin on public.events for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy memories_admin on public.memories for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy bookings_admin on public.bookings for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy payments_admin on public.payments for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy memberships_admin on public.memberships for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy messages_read on public.messages for select using (
  public.has_any_role(array['member', 'moderator', 'admin']) and (channel = 'general' or position(auth.uid()::text in channel) > 0)
);
create policy messages_write on public.messages for insert with check (
  public.has_any_role(array['member', 'moderator', 'admin']) and author_id = auth.uid() and (channel = 'general' or position(auth.uid()::text in channel) > 0)
);
-- modération : les modératrices et les administratrices peuvent retirer un message du salon
create policy messages_moderate on public.messages for delete using (
  public.has_role('admin') or (public.has_role('moderator') and channel = 'general')
);

create policy reminders_admin on public.reminders for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- user_roles : chacune voit les siens ; le cercle voit ceux des autres (badges « Fondatrice ») ; l'admin gère.
alter table public.user_roles enable row level security;
create policy user_roles_select on public.user_roles for select using (
  profile_id = auth.uid() or public.has_any_role(array['member', 'moderator', 'admin'])
);
create policy user_roles_admin on public.user_roles for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------------------------------------------------------------------
-- 4. Vues des fondatrices, avec les rôles
-- ---------------------------------------------------------------------
create view public.dues_by_month with (security_invoker = on) as
  select date_trunc('month', plan_ends_at)::date as month, count(*)::int as count
    from public.profiles
   where public.user_has_any_role(id, array['member']) and plan <> 'free' and plan_ends_at >= current_date
   group by 1;

create view public.founder_actions with (security_invoker = on) as
  select 'transfer'::text as kind, p.id as ref_id, p.payer_name as label, p.amount, p.declared_at::date as due
    from public.payments p where p.status = 'declared' and p.method = 'transfer'
  union all
  select 'renewal', pr.id, trim(pr.first_name || ' ' || pr.last_name), case when pr.plan = 'premium' then 1250 else 670 end, pr.plan_ends_at
    from public.profiles pr where public.user_has_any_role(pr.id, array['member']) and pr.plan_ends_at between current_date and current_date + 30
  union all
  select 'expired', pr.id, trim(pr.first_name || ' ' || pr.last_name), case when pr.plan = 'premium' then 1250 else 670 end, pr.plan_ends_at
    from public.profiles pr where public.user_has_any_role(pr.id, array['member']) and pr.plan_ends_at between current_date - 60 and current_date - 1
  union all
  select 'unpaid', e.id, e.title, sum(b.amount)::int, e.starts_at::date
    from public.bookings b join public.events e on e.id = b.event_id
   where b.status = 'pending' and b.method <> 'transfer' and e.starts_at >= now()
   group by e.id, e.title, e.starts_at
  union all
  select 'free_account', pr.id, trim(pr.first_name || ' ' || pr.last_name), 0, null
    from public.profiles pr
   where not exists (select 1 from public.user_roles ur where ur.profile_id = pr.id)
     and not exists (select 1 from public.reminders r where r.profile_id = pr.id and r.reason = 'invite')
  union all
  select 'draft', e.id, e.title, 0, e.starts_at::date from public.events e where e.status = 'draft';

-- vues de pilotage : jamais pour les visiteuses anonymes
revoke all on public.founder_actions, public.dues_by_month, public.revenue_by_month from anon;

-- ---------------------------------------------------------------------
-- 5. Organisations : établissements des partenaires et des pros
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 2 and 120),
  kinds text[] not null check (cardinality(kinds) > 0 and kinds <@ array['partner', 'pro']::text[]),
  category text not null default '',
  description text,
  address text,
  area text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  contact_name text,
  phone text,
  email text,
  website text,
  instagram text,
  status text not null default 'pending' check (status in ('active', 'pending', 'suspended')),
  place_id uuid references public.places (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint coords_together check ((lat is null) = (lng is null))
);
create index organizations_status_idx on public.organizations (status);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);
create index organization_members_profile_idx on public.organization_members (profile_id);

-- Offres partenaires reliées à leur établissement.
alter table public.partner_offers add column organization_id uuid references public.organizations (id) on delete set null;

-- La personne connectée fait-elle partie de cet établissement (avec l'un de ces rôles) ?
create or replace function public.is_org_member(p_org uuid, p_roles text[] default array['owner', 'staff']) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
     where organization_id = p_org and profile_id = auth.uid() and role = any (p_roles)
  );
$$;

-- Deux personnes travaillent-elles dans le même établissement ? (fiche des collègues)
create or replace function public.shares_organization(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members a
      join public.organization_members b on b.organization_id = a.organization_id
     where a.profile_id = auth.uid() and b.profile_id = p_other
  );
$$;
revoke all on function public.is_org_member(uuid, text[]) from public, anon;
revoke all on function public.shares_organization(uuid) from public, anon;
grant execute on function public.is_org_member(uuid, text[]) to authenticated, service_role;
grant execute on function public.shares_organization(uuid) to authenticated, service_role;

-- La propriétaire modifie la fiche de son établissement, mais pas son statut, ses types ni son adresse web interne.
create or replace function public.protect_organization() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or public.has_role('admin') then return new; end if;
  if new.status is distinct from old.status or new.kinds is distinct from old.kinds or new.slug is distinct from old.slug then
    raise exception 'Modification réservée aux fondatrices.';
  end if;
  return new;
end $$;
create trigger organizations_protect before update on public.organizations for each row execute function public.protect_organization();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy organizations_select on public.organizations for select to authenticated using (
  public.has_role('admin')
  or public.is_org_member(id)
  or (status = 'active' and public.has_any_role(array['member', 'moderator', 'admin']))
);
create policy organizations_owner_update on public.organizations for update to authenticated
  using (public.is_org_member(id, array['owner'])) with check (public.is_org_member(id, array['owner']));
create policy organizations_admin on public.organizations for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy organization_members_select on public.organization_members for select to authenticated using (
  public.has_role('admin') or profile_id = auth.uid() or public.is_org_member(organization_id)
);
create policy organization_members_admin on public.organization_members for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- Les collègues d'un même établissement voient leurs fiches.
create policy profiles_select_colleagues on public.profiles for select to authenticated using (public.shares_organization(id));

-- ---------------------------------------------------------------------
-- 6. Journal des opérations importantes
-- ---------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_type text not null check (target_type in ('payment', 'event', 'profile', 'reminder', 'organization')),
  target_id uuid,
  summary text not null check (length(summary) between 1 and 300),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_target_idx on public.audit_log (target_type, target_id);

alter table public.audit_log enable row level security;
-- lecture : administratrices ; écriture : en son propre nom (administratrices, modératrices) ; jamais modifié ni effacé.
create policy audit_log_admin_read on public.audit_log for select using (public.has_role('admin'));
create policy audit_log_insert on public.audit_log for insert with check (
  actor_id = auth.uid() and public.has_any_role(array['admin', 'moderator'])
);
revoke update, delete, truncate on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Notifications in-app et préférences
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('booking_confirmed', 'waitlist_spot', 'event_published', 'payment_validated', 'role_changed')),
  title text not null check (length(title) between 1 and 160),
  body text not null default '' check (length(body) <= 600),
  link text check (link is null or link ~ '^/[^/]'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

create table public.notification_prefs (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('booking_confirmed', 'waitlist_spot', 'event_published', 'payment_validated', 'role_changed')),
  in_app boolean not null default true,
  email boolean not null default true,
  push boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (profile_id, type)
);

-- Une notification coupée par sa destinataire n'est pas enregistrée (quel que soit l'expéditeur).
create or replace function public.notifications_respect_prefs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.notification_prefs where profile_id = new.recipient_id and type = new.type and not in_app) then
    return null;
  end if;
  return new;
end $$;
create trigger notifications_prefs before insert on public.notifications for each row execute function public.notifications_respect_prefs();

alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;

create policy notifications_own_read on public.notifications for select using (recipient_id = auth.uid());
create policy notifications_own_update on public.notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_own_delete on public.notifications for delete using (recipient_id = auth.uid());
-- création : pour soi-même, ou par une administratrice (le serveur utilise aussi la clé service pour les autres cas)
create policy notifications_insert on public.notifications for insert with check (recipient_id = auth.uid() or public.has_role('admin'));
-- seule la date de lecture est modifiable par la destinataire
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke all on public.notifications from anon;

create policy notification_prefs_own on public.notification_prefs for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
revoke all on public.notification_prefs from anon;
