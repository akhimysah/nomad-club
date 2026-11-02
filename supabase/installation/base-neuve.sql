-- Nomad Club : installation complète d'une base Supabase NEUVE (0001 à 0012).
-- À coller tel quel dans Supabase > SQL Editor > New query, puis Run. Aucune donnée d'exemple.
-- Généré par « npm run sql:installation » depuis supabase/migrations/ : ne pas modifier à la main.

-- ===================== 0001_init.sql =====================
-- =====================================================================
-- Nomad Club : schéma initial (Postgres / Supabase)
-- Tables, contraintes, index, sécurité ligne par ligne (RLS), vues et fonctions.
-- À exécuter une fois dans Supabase (SQL Editor) ou avec `supabase db push`.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Profils (un par compte Supabase Auth)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  whatsapp text,
  email text,
  job text,
  country text,
  bio text,
  role text not null default 'guest' check (role in ('guest', 'member', 'founder')),
  plan text not null default 'free' check (plan in ('free', 'member', 'premium')),
  plan_ends_at date,
  avatar_url text,
  marrakech_since text,
  card_number text unique,
  created_at timestamptz not null default now(),
  constraint plan_has_end check (plan = 'free' or plan_ends_at is not null)
);
create index profiles_role_idx on public.profiles (role);
create index profiles_plan_ends_idx on public.profiles (plan_ends_at);

create sequence public.card_number_seq start 700;

-- ---------------------------------------------------------------------
-- Carnet d'adresses
-- ---------------------------------------------------------------------
create table public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null,
  area text not null,
  note text not null default '',
  categories text[] not null default '{}' check (categories <@ array['manger', 'sortir', 'bien-etre-sport', 'famille']::text[]),
  recommended_by text not null default '',
  club_event_label text,
  club_event_date date,
  url text,
  image text,
  image_position text,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- Rendez-vous
-- ---------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (length(title) between 3 and 120),
  short_title text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  place_id uuid references public.places (id) on delete set null,
  venue text,
  address text,
  description text not null default '',
  program jsonb not null default '[]'::jsonb,
  capacity int not null check (capacity between 1 and 500),
  price_public int not null default 0 check (price_public >= 0),
  price_member int not null default 0 check (price_member >= 0),
  premium_free boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  image text,
  image_position text,
  image_zoom text,
  image_caption text,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ends_after_start check (ends_at is null or ends_at > starts_at),
  -- un rendez-vous publié a toujours un lieu
  constraint published_has_venue check (status <> 'published' or venue is not null)
);
create index events_status_start_idx on public.events (status, starts_at);

-- ---------------------------------------------------------------------
-- Réservations (avec ou sans compte)
-- ---------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  guest_first_name text,
  guest_whatsapp text,
  status text not null check (status in ('pending', 'paid', 'offered', 'waitlist', 'cancelled')),
  amount int not null default 0 check (amount >= 0),
  method text not null check (method in ('card', 'transfer', 'free')),
  ticket_code text not null unique check (ticket_code ~ '^NC-[0-9]{4}-[A-Z0-9]{4}$'),
  stripe_session_id text unique,
  created_at timestamptz not null default now(),
  constraint booking_has_holder check (profile_id is not null or guest_first_name is not null)
);
create index bookings_event_status_idx on public.bookings (event_id, status);
create index bookings_profile_idx on public.bookings (profile_id);
-- une seule réservation active par personne et par rendez-vous
create unique index bookings_one_per_profile on public.bookings (event_id, profile_id) where status <> 'cancelled' and profile_id is not null;

-- ---------------------------------------------------------------------
-- Paiements (billets et adhésions)
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  payer_name text not null,
  kind text not null check (kind in ('booking', 'membership')),
  booking_id uuid references public.bookings (id) on delete set null,
  plan text check (plan in ('member', 'premium')),
  membership_action text check (membership_action in ('join', 'renew', 'upgrade')),
  amount int not null check (amount >= 0),
  method text not null check (method in ('card', 'transfer', 'free')),
  status text not null default 'declared' check (status in ('declared', 'validated', 'refunded')),
  declared_at timestamptz not null default now(),
  validated_at timestamptz,
  validated_by uuid references public.profiles (id) on delete set null,
  stripe_session_id text unique,
  constraint membership_has_plan check (kind <> 'membership' or (plan is not null and membership_action is not null)),
  constraint validated_has_date check (status <> 'validated' or validated_at is not null)
);
create index payments_status_idx on public.payments (status);
create index payments_profile_idx on public.payments (profile_id);
create index payments_validated_at_idx on public.payments (validated_at);

-- ---------------------------------------------------------------------
-- Périodes d'adhésion
-- ---------------------------------------------------------------------
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null check (plan in ('member', 'premium')),
  starts_at date not null,
  ends_at date not null,
  status text not null default 'active' check (status in ('active', 'pending', 'expired', 'cancelled')),
  constraint membership_period check (ends_at > starts_at)
);
create index memberships_profile_idx on public.memberships (profile_id);

-- ---------------------------------------------------------------------
-- Souvenirs « Déjà vécu au club »
-- ---------------------------------------------------------------------
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  place text not null,
  date_label text not null,
  participants int not null default 0,
  image text not null,
  image_position text,
  attendees text[] not null default '{}',
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- Salon et messages privés
-- ---------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel = 'general' or channel ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$'),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_channel_idx on public.messages (channel, created_at);

-- ---------------------------------------------------------------------
-- Relances (envoyées et programmées)
-- ---------------------------------------------------------------------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  reason text not null check (reason in ('renewal', 'expired', 'unpaid', 'invite')),
  due_at date,
  sent_at timestamptz,
  answered boolean not null default false,
  scheduled_for date,
  sent_by uuid references public.profiles (id) on delete set null,
  constraint reminder_target check (profile_id is not null or event_id is not null)
);
create index reminders_profile_idx on public.reminders (profile_id);
create index reminders_scheduled_idx on public.reminders (scheduled_for) where sent_at is null;

-- ---------------------------------------------------------------------
-- Offres partenaires
-- ---------------------------------------------------------------------
create table public.partner_offers (
  id uuid primary key default gen_random_uuid(),
  badge text not null,
  partner text not null,
  detail text not null,
  sort_order int not null default 0
);

-- =====================================================================
-- Fonctions utilitaires de sécurité
-- =====================================================================
create or replace function public.is_founder() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'founder');
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('member', 'founder'));
$$;

-- Une adhérente ne peut pas modifier elle-même son rôle, sa formule ou son échéance.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('nc.trusted', true), '') = 'on' or auth.role() = 'service_role' or public.is_founder() then
    return new;
  end if;
  if new.role is distinct from old.role or new.plan is distinct from old.plan
     or new.plan_ends_at is distinct from old.plan_ends_at or new.card_number is distinct from old.card_number then
    raise exception 'Modification réservée aux fondatrices.';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile();

-- Profil créé automatiquement à la première connexion (lien magique).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, whatsapp)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', initcap(split_part(coalesce(new.email, ''), '@', 1))),
    new.raw_user_meta_data ->> 'whatsapp'
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- =====================================================================
-- Fonctions métier (appelées par l'appli via supabase.rpc)
-- =====================================================================

-- Code de billet « NC-2610-K7QD ».
create or replace function public.new_ticket_code(p_starts timestamptz) returns text
language plpgsql volatile set search_path = public as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := 'NC-' || to_char(p_starts at time zone 'Africa/Casablanca', 'DDMM') || '-';
    for i in 1..4 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bookings where ticket_code = code);
  end loop;
  return code;
end $$;

-- Réserver : contrôle des places (verrou sur le rendez-vous), prix calculé ici selon la formule,
-- liste d'attente si complet. Une place payante reste « pending » jusqu'au paiement.
create or replace function public.book_event(
  p_event uuid,
  p_guest_first_name text default null,
  p_guest_whatsapp text default null,
  p_mode text default 'transfer',
  p_waitlist boolean default false
) returns json
language plpgsql security definer set search_path = public as $$
declare
  ev public.events;
  me public.profiles;
  v_plan text := 'free';
  v_price int;
  v_taken int;
  v_wait int;
  v_existing public.bookings;
  v_booking public.bookings;
  v_status text;
  v_method text;
begin
  select * into ev from public.events where id = p_event for update;
  if not found or ev.status <> 'published' or ev.starts_at < now() - interval '1 day' then
    raise exception 'closed';
  end if;
  if auth.uid() is not null then
    select * into me from public.profiles where id = auth.uid();
    v_plan := coalesce(me.plan, 'free');
    if me.plan_ends_at is not null and me.plan_ends_at < current_date then v_plan := 'free'; end if;
  elsif coalesce(length(trim(p_guest_first_name)), 0) < 2 or length(regexp_replace(coalesce(p_guest_whatsapp, ''), '\D', '', 'g')) < 8 then
    raise exception 'guest';
  end if;

  -- déjà inscrite ?
  select * into v_existing from public.bookings b
   where b.event_id = ev.id and b.status <> 'cancelled'
     and ((me.id is not null and b.profile_id = me.id)
       or (me.id is null and regexp_replace(coalesce(b.guest_whatsapp, ''), '\D', '', 'g') = regexp_replace(p_guest_whatsapp, '\D', '', 'g')))
   limit 1;
  if found then
    return json_build_object('status', 'already', 'booking_id', v_existing.id, 'ticket_code', v_existing.ticket_code, 'booking_status', v_existing.status);
  end if;

  if ev.premium_free then
    v_price := case when v_plan = 'premium' then 0 else null end;
  else
    v_price := case when v_plan = 'free' then ev.price_public else ev.price_member end;
  end if;
  if v_price is null and not p_waitlist then raise exception 'premium_only'; end if;

  select count(*) filter (where status in ('pending', 'paid', 'offered')), count(*) filter (where status = 'waitlist')
    into v_taken, v_wait from public.bookings where event_id = ev.id;

  if v_taken >= ev.capacity then
    if not p_waitlist then return json_build_object('status', 'full'); end if;
    insert into public.bookings (event_id, profile_id, guest_first_name, guest_whatsapp, status, amount, method, ticket_code)
    values (ev.id, me.id, case when me.id is null then trim(p_guest_first_name) end, case when me.id is null then p_guest_whatsapp end,
            'waitlist', 0, 'free', public.new_ticket_code(ev.starts_at))
    returning * into v_booking;
    return json_build_object('status', 'waitlist', 'booking_id', v_booking.id, 'ticket_code', v_booking.ticket_code, 'position', v_wait + 1);
  end if;

  v_price := coalesce(v_price, 0);
  if v_price = 0 then
    v_status := case when ev.premium_free then 'offered' else 'paid' end;
    v_method := 'free';
  else
    v_status := 'pending';
    v_method := case when p_mode = 'stripe' then 'card' else 'transfer' end;
  end if;

  insert into public.bookings (event_id, profile_id, guest_first_name, guest_whatsapp, status, amount, method, ticket_code)
  values (ev.id, me.id, case when me.id is null then trim(p_guest_first_name) end, case when me.id is null then p_guest_whatsapp end,
          v_status, v_price, v_method, public.new_ticket_code(ev.starts_at))
  returning * into v_booking;

  if v_method = 'transfer' then
    insert into public.payments (profile_id, payer_name, kind, booking_id, amount, method, status)
    values (me.id, coalesce(nullif(trim(coalesce(me.first_name, '') || ' ' || coalesce(me.last_name, '')), ''), trim(p_guest_first_name)),
            'booking', v_booking.id, v_price, 'transfer', 'declared');
  end if;

  return json_build_object('status', 'booked', 'booking_id', v_booking.id, 'ticket_code', v_booking.ticket_code);
end $$;

-- Annuler sa propre réservation.
create or replace function public.cancel_booking(p_booking uuid) returns void
language sql security definer set search_path = public as $$
  update public.bookings set status = 'cancelled'
   where id = p_booking and profile_id = auth.uid() and status <> 'cancelled';
$$;

-- Billet consultable par son code (lien WhatsApp, retour de paiement) : informations limitées.
create or replace function public.get_ticket(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'booking', json_build_object('id', b.id, 'event_id', b.event_id, 'profile_id', b.profile_id, 'guest_first_name', b.guest_first_name,
                                 'status', b.status, 'amount', b.amount, 'method', b.method, 'ticket_code', b.ticket_code, 'created_at', b.created_at),
    'event', to_json(e),
    'holder', coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), b.guest_first_name, 'Invitée')
  )
  from public.bookings b
  join public.events e on e.id = b.event_id
  left join public.profiles p on p.id = b.profile_id
  where b.ticket_code = upper(p_code);
$$;

-- Déclarer un virement d'adhésion (montant calculé ici).
create or replace function public.declare_membership(p_action text, p_plan text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  v_amount int;
  v_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'login'; end if;
  if p_action not in ('join', 'renew', 'upgrade') or p_plan not in ('member', 'premium') then raise exception 'invalid'; end if;
  v_amount := case when p_action = 'upgrade' then 580 when p_plan = 'premium' then 1250 else 670 end;
  insert into public.payments (profile_id, payer_name, kind, plan, membership_action, amount, method, status)
  values (me.id, trim(me.first_name || ' ' || me.last_name), 'membership', case when p_action = 'upgrade' then 'premium' else p_plan end, p_action, v_amount, 'transfer', 'declared')
  returning id into v_id;
  return v_id;
end $$;

-- Effet d'une adhésion payée sur le profil (un an ; renouvellement à partir de l'échéance ; Premium à échéance égale).
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
         role = case when role = 'founder' then 'founder' else 'member' end,
         card_number = coalesce(card_number, 'NC ' || lpad(nextval('public.card_number_seq')::text, 4, '0'))
   where id = me.id;
  update public.memberships set status = 'expired' where profile_id = me.id and status = 'active' and ends_at <= v_start;
  insert into public.memberships (profile_id, plan, starts_at, ends_at, status) values (me.id, v_plan, v_start, v_end, 'active');
  perform set_config('nc.trusted', 'off', true);
end $$;
revoke all on function public.apply_membership(uuid) from public, anon, authenticated;

-- Valider un virement (fondatrices).
create or replace function public.validate_payment(p_payment uuid) returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments;
begin
  if not public.is_founder() then raise exception 'founder_only'; end if;
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

-- Paiement Stripe confirmé (webhook, clé service uniquement).
create or replace function public.mark_stripe_paid(p_session text, p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  v_name text;
  v_pay uuid;
begin
  if p_kind = 'booking' then
    update public.bookings set status = 'paid', stripe_session_id = p_session
     where id = p_id and status in ('pending', 'cancelled')
    returning * into b;
    if not found then return; end if;
    select coalesce(nullif(trim(first_name || ' ' || last_name), ''), b.guest_first_name, 'Invitée') into v_name from public.profiles where id = b.profile_id;
    insert into public.payments (profile_id, payer_name, kind, booking_id, amount, method, status, validated_at, stripe_session_id)
    values (b.profile_id, coalesce(v_name, b.guest_first_name, 'Invitée'), 'booking', b.id, b.amount, 'card', 'validated', now(), p_session)
    on conflict (stripe_session_id) do nothing;
  else
    update public.payments set status = 'validated', validated_at = now(), stripe_session_id = p_session
     where id = p_id and status = 'declared'
    returning id into v_pay;
    if v_pay is not null then perform public.apply_membership(v_pay); end if;
  end if;
end $$;
revoke all on function public.mark_stripe_paid(text, text, uuid) from public, anon, authenticated;
grant execute on function public.mark_stripe_paid(text, text, uuid) to service_role;

-- Marquer une conversation privée comme lue.
create or replace function public.mark_dm_read(p_other uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
   where read_at is null and author_id = p_other
     and channel = 'dm:' || least(auth.uid()::text collate "C", p_other::text collate "C") || ':' || greatest(auth.uid()::text collate "C", p_other::text collate "C");
$$;

grant execute on function public.book_event(uuid, text, text, text, boolean) to anon, authenticated;
grant execute on function public.get_ticket(text) to anon, authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.declare_membership(text, text) to authenticated;
grant execute on function public.validate_payment(uuid) to authenticated;
grant execute on function public.mark_dm_read(uuid) to authenticated;

-- =====================================================================
-- Vues
-- =====================================================================

-- Remplissage par rendez-vous (compteurs seulement : lisible par toutes, sans exposer les réservations).
create view public.event_fill as
  select e.id as event_id,
         count(b.*) filter (where b.status in ('paid', 'offered'))::int as paid,
         count(b.*) filter (where b.status = 'pending')::int as pending,
         count(b.*) filter (where b.status = 'waitlist')::int as waitlist
    from public.events e
    left join public.bookings b on b.event_id = e.id
   group by e.id;
grant select on public.event_fill to anon, authenticated;

-- Encaissements par mois (fondatrices : la RLS de payments s'applique).
create view public.revenue_by_month with (security_invoker = on) as
  select date_trunc('month', validated_at at time zone 'Africa/Casablanca')::date as month,
         sum(amount) filter (where kind = 'membership')::int as memberships,
         sum(amount) filter (where kind = 'booking')::int as tickets
    from public.payments
   where status = 'validated'
   group by 1;

-- Échéances d'adhésion par mois (adhérentes actives).
create view public.dues_by_month with (security_invoker = on) as
  select date_trunc('month', plan_ends_at)::date as month, count(*)::int as count
    from public.profiles
   where role = 'member' and plan <> 'free' and plan_ends_at >= current_date
   group by 1;

-- Actions à traiter (virements, renouvellements, adhésions échues, billets impayés, comptes gratuits, brouillons).
create view public.founder_actions with (security_invoker = on) as
  select 'transfer'::text as kind, p.id as ref_id, p.payer_name as label, p.amount, p.declared_at::date as due
    from public.payments p where p.status = 'declared' and p.method = 'transfer'
  union all
  select 'renewal', pr.id, trim(pr.first_name || ' ' || pr.last_name), case when pr.plan = 'premium' then 1250 else 670 end, pr.plan_ends_at
    from public.profiles pr where pr.role = 'member' and pr.plan_ends_at between current_date and current_date + 30
  union all
  select 'expired', pr.id, trim(pr.first_name || ' ' || pr.last_name), case when pr.plan = 'premium' then 1250 else 670 end, pr.plan_ends_at
    from public.profiles pr where pr.role = 'member' and pr.plan_ends_at between current_date - 60 and current_date - 1
  union all
  select 'unpaid', e.id, e.title, sum(b.amount)::int, e.starts_at::date
    from public.bookings b join public.events e on e.id = b.event_id
   where b.status = 'pending' and b.method <> 'transfer' and e.starts_at >= now()
   group by e.id, e.title, e.starts_at
  union all
  select 'free_account', pr.id, trim(pr.first_name || ' ' || pr.last_name), 0, null
    from public.profiles pr
   where pr.role = 'guest' and not exists (select 1 from public.reminders r where r.profile_id = pr.id and r.reason = 'invite')
  union all
  select 'draft', e.id, e.title, 0, e.starts_at::date from public.events e where e.status = 'draft';

-- =====================================================================
-- Sécurité ligne par ligne (RLS)
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.events enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.memberships enable row level security;
alter table public.memories enable row level security;
alter table public.messages enable row level security;
alter table public.reminders enable row level security;
alter table public.partner_offers enable row level security;

-- profils : chacune lit et modifie le sien ; les adhérentes voient l'annuaire ; les fondatrices voient tout.
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_select_directory on public.profiles for select using (public.is_member() and role in ('member', 'founder'));
create policy profiles_founders on public.profiles for all using (public.is_founder()) with check (public.is_founder());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- carnet et offres : adhérentes ; écriture fondatrices.
create policy places_members on public.places for select using (public.is_member());
create policy places_founders on public.places for all using (public.is_founder()) with check (public.is_founder());
create policy offers_members on public.partner_offers for select using (public.is_member());
create policy offers_founders on public.partner_offers for all using (public.is_founder()) with check (public.is_founder());

-- rendez-vous publiés et souvenirs : publics ; écriture fondatrices.
create policy events_public on public.events for select using (status = 'published');
create policy events_founders on public.events for all using (public.is_founder()) with check (public.is_founder());
create policy memories_public on public.memories for select using (true);
create policy memories_founders on public.memories for all using (public.is_founder()) with check (public.is_founder());

-- réservations, paiements, adhésions : chacune les siennes (écriture par les fonctions ci-dessus) ; fondatrices tout.
create policy bookings_own on public.bookings for select using (profile_id = auth.uid());
create policy bookings_founders on public.bookings for all using (public.is_founder()) with check (public.is_founder());
create policy payments_own on public.payments for select using (profile_id = auth.uid());
create policy payments_founders on public.payments for all using (public.is_founder()) with check (public.is_founder());
create policy memberships_own on public.memberships for select using (profile_id = auth.uid());
create policy memberships_founders on public.memberships for all using (public.is_founder()) with check (public.is_founder());

-- salon et messages privés : adhérentes uniquement, chacune n'écrit qu'en son nom.
create policy messages_read on public.messages for select using (
  public.is_member() and (channel = 'general' or position(auth.uid()::text in channel) > 0)
);
create policy messages_write on public.messages for insert with check (
  public.is_member() and author_id = auth.uid() and (channel = 'general' or position(auth.uid()::text in channel) > 0)
);
create policy messages_founders on public.messages for delete using (public.is_founder());

-- relances : fondatrices.
create policy reminders_founders on public.reminders for all using (public.is_founder()) with check (public.is_founder());


-- ===================== 0002_carnet_annuaire.sql =====================
-- Nomad Club : carnet d'adresses enrichi (annuaire pratique).
-- À exécuter APRÈS 0001_init.sql. Peut être relancé sans risque.

-- Nouvelles informations pratiques sur chaque lieu.
alter table public.places
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists hours text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists badge text check (badge in ('top', 'new', 'exclusive'));

-- Nouvelles catégories de filtre.
alter table public.places drop constraint if exists places_categories_check;
alter table public.places add constraint places_categories_check check (
  categories <@ array['manger', 'sortir', 'bien-etre-sport', 'famille', 'hotels-piscines', 'beaute', 'sante', 'urgences', 'shopping', 'pratique']::text[]
);

-- Les 157 adresses de l'annuaire (après les lieux du club).
insert into public.places (id, slug, name, kind, area, note, categories, recommended_by, url, phone, address, hours, tags, badge, sort_order) values
  ('e348812b-8b62-4484-a706-c74b7d640477', 'nomad', 'Nomad', 'Marocain moderne / Rooftop', 'Médina – Rahba Kedima', 'Cuisine marocaine revisitée, vue imprenable sur les souks et l''Atlas. Incontournable.', array['manger', 'sortir']::text[], '', null, '+212 524 381 609', 'Rahba Kedima, Médina', '12h–23h', array['Rooftop', 'Vue Atlas', 'Déj & dîner']::text[], 'top', 1000),
  ('e88fa938-e4da-4edc-a17b-0882695eba91', 'le-foundouk', 'Le Foundouk', 'Marocain raffiné / Terrasse', 'Médina', 'Vieux fondouk restauré, cuisine traditionnelle et internationale dans un cadre pittoresque.', array['manger']::text[], '', null, '+212 524 378 190', '55 Souk Hal Fassis, Médina', '12h–23h – Fermé lundi', array['Cadre historique', 'Terrasse', 'Gastronomique']::text[], null, 1001),
  ('435e943b-36a6-4617-ad52-7dffaa61240d', 'dar-yacout', 'Dar Yacout', 'Gastronomique marocain', 'Médina', 'Restaurant le plus prestigieux de Marrakech dans un riad somptueux. Réservation obligatoire.', array['manger', 'sortir']::text[], '', null, '+212 524 382 929', '79 Derb Sidi Ahmed Soussi, Médina', '19h30–23h – Fermé mardi', array['Luxe', 'Soirée spéciale', 'Spectacle']::text[], 'top', 1002),
  ('d35e5318-b6c2-442c-ad19-6844d2b593e8', 'sesamo-royal-mansour', 'Sesamo – Royal Mansour', 'Gastronomique italien/méditerranéen', 'Médina', 'Chef Riccardo Barni, produits locaux Slow Food, pâtes fraîches maison. Menu change 5x/an.', array['manger']::text[], '', null, '+212 529 808 080', 'Rue Abou El Abbas Sebti', 'Dîner ts jours, déj week-end', array['Luxe', 'Slow Food', 'Pâtes fraîches']::text[], 'top', 1003),
  ('db1ea3d9-662c-4fb0-aed9-973e855822aa', 'sabo-selman-marrakech', 'SABO – Selman Marrakech', 'Gastronomique franco-marocain', 'Palmeraie', 'Ouvert en mai 2025, né d''une vision entre Selman et Jean-François Piège.', array['manger']::text[], '', null, '+212 524 459 600', 'km 6 Route de l''Ourika', 'Dîner – Réservation requise', array['Nouveau 2025', 'Étoilé', 'Luxe']::text[], 'new', 1004),
  ('476fe48f-e600-4d84-a094-96505a5d43e8', 'brasserie-tfaya-al-maaden', 'Brasserie Tfaya – Al Maaden', 'Gastronomique marocain contemporain', 'Al Maaden', 'Chef Issam Rhachi – épaule d''agneau en croûte de foin, pastilla de fruits de mer.', array['manger']::text[], '', null, '+212 524 404 040', 'Golf d''Al Maaden, Sidi Youssef Ben Ali', '19h–23h', array['Chef signature', 'Dîner seulement', 'Terroir']::text[], null, 1005),
  ('bb7a0711-5750-4414-ad0b-57e223b37c92', 'al-fassia', 'Al Fassia', 'Marocain traditionnel', 'Guéliz', 'Tenu par des femmes, cuisine familiale marocaine vénérée par les habitants depuis des décennies.', array['manger']::text[], '', null, '+212 524 431 060', '55 Bd Zerktouni, Guéliz', '12h–15h & 19h30–23h – Fermé mardi', array['Femmes chefs', 'Authentique', 'Végétarien friendly']::text[], 'top', 1006),
  ('27485237-5d29-46bf-aafa-398dae51b1d1', 'kabana', 'Kabana', 'Fusion méditerranéenne-latine / Rooftop', 'Médina', 'Vue Koutoubia, fusion méditerranéenne et latine, point de rendez-vous des expats branchés.', array['manger', 'sortir']::text[], '', null, '+212 524 391 858', 'Rue Sidi Abd el Aziz, Médina', '12h–24h', array['Rooftop', 'Vue Koutoubia', 'Cocktails']::text[], null, 1007),
  ('9d7146c9-c80d-4d5f-ae17-5590ea70f172', 'kosybar', 'Kosybar', 'Bar-restaurant panoramique', 'Kasbah', 'Plusieurs étages, vues panoramiques sur la Place des Ferblantiers. Animé le soir.', array['manger', 'sortir']::text[], '', null, '+212 524 380 324', '47 Place des Ferblantiers', '10h–24h', array['Cocktails', 'Vue Kasbah', 'Sunset']::text[], null, 1008),
  ('5bd1e552-39ae-4979-a96e-1004bc45a07b', 'comptoir-darna', 'Comptoir Darna', 'Festif marocain / Dîner-spectacle', 'Guéliz', 'Gastronomie marocaine et ambiance festive, danse orientale en soirée. Un classique.', array['manger', 'sortir']::text[], '', null, '+212 524 437 702', 'Av. Echouhada, Hivernage', '19h30–24h', array['Spectacle', 'Ambiance', 'Soirée']::text[], null, 1009),
  ('ca678e29-a352-4075-a150-86e7f8c73fde', 'la-mamounia-le-francais', 'La Mamounia – Le Français', 'Gastronomique français', 'Hivernage', 'Table emblématique du palace mythique. Service impeccable, décor raffiné, jardin enchanteur.', array['manger']::text[], '', null, '+212 524 888 888', 'Avenue Bab Jdid', '12h30–15h & 19h30–23h', array['Palace', 'Luxe', 'Déj & dîner']::text[], 'top', 1010),
  ('4214f30c-6d00-4c1e-aa2c-e00ae2934b80', 'la-grande-table-marocaine-royal-mansour', 'La Grande Table Marocaine – Royal Mansour', 'Haute gastronomie marocaine', 'Médina', 'Cuisine traditionnelle revisitée avec créativité. Adresse la plus prestigieuse de la ville.', array['manger']::text[], '', null, '+212 529 808 080', 'Rue Abou El Abbas Sebti', 'Déj & dîner – Réservation requise', array['Palace', 'Grand Chef', 'Prestige']::text[], 'top', 1011),
  ('25e12391-0049-4073-aa8e-4cb685a6b21f', 'pepe-nero', 'Pepe Nero', 'Italien-marocain fusion', 'Médina', 'Mosaïques, fontaines, ambiance romantique. Couscous royal + pâtes fraîches.', array['manger']::text[], '', null, '+212 524 389 067', '17 Derb Cherkaoui, Médina', null, array['Fusion', 'Romantique', 'Cadre somptueux']::text[], null, 1012),
  ('bbd7b9c7-599f-4191-ab58-b98322f84a52', 'boeuf-sur-le-toit-villa-yvette', 'Boeuf sur le Toit – Villa Yvette', 'Français / Brasserie chic', 'Guéliz', 'Ambiance années 20 parisienne dans la Villa Yvette. Beef, homard, musique live.', array['manger', 'sortir']::text[], '', null, '+212 524 442 244', 'Villa Yvette, Guéliz', null, array['Français', 'Chic', 'Ambiance']::text[], null, 1013),
  ('b744687f-f377-4a53-ad47-385a2a9c4299', 'l-o-a-la-bouche', 'L''Ô à la Bouche', 'Gastronomique français', 'Guéliz', 'Cuisine française raffinée, cadre élégant et intime. Référence pour les amateurs de gastronomie française.', array['manger']::text[], '', null, '+212 524 434 894', 'Rue Ibn Aicha, Guéliz', null, array['Français', 'Intime', 'Gastronomique']::text[], null, 1014),
  ('3a6ed6f8-781b-4620-a65f-5ac7156a7cb9', 'le-jardin', 'Le Jardin', 'Marocain / Jardin secret', 'Médina', 'Oasis de fraîcheur au cœur de la médina. Tajine de crevettes, pastilla poulet. Bougies et safran.', array['manger']::text[], '', null, '+212 524 378 295', '32 Souk Jeld, Semmarine, Médina', '10h–23h', array['Jardin', 'Romantique', 'Médina']::text[], null, 1015),
  ('9c2c3f31-d6af-4c90-aa9e-3a49b64f22fa', 'l-mida', 'L''mida', 'Marocain traditionnel / Terrasse', 'Médina', 'Terrasse avec vue imprenable sur la médina, tajine citron confit, méchoui d''agneau.', array['manger']::text[], '', null, '+212 524 391 536', '78 Rahba Lakdima, Médina', null, array['Terrasse', 'Vue Médina', 'Authentique']::text[], null, 1016),
  ('59920e7d-6e67-433a-a655-a85b5b829f2f', 'amal-restaurant-social', 'Amal Restaurant Social', 'Marocain authentique / Social', 'Guéliz', 'Entreprise sociale formant des femmes. Recettes familiales authentiques. Déjeuner uniquement.', array['manger']::text[], '', null, '+212 524 446 896', 'Rue Allal El Fassi, Guéliz', '12h–15h – Fermé dimanche', array['Social', 'Authentique', 'Déjeuner']::text[], null, 1017),
  ('a10b4474-551f-4177-a13b-4ddc54cff35b', 'ksar-essaoussan', 'Ksar Essaoussan', 'Marocain raffiné dans riad historique', 'Médina', 'Riad restauré, cuisine marocaine raffinée, salades légendaires. Ambiance typique et élégante.', array['manger']::text[], '', null, '+212 524 440 632', 'Riad Kennaria, Médina', null, array['Riad', 'Historique', 'Salades']::text[], null, 1018),
  ('838ab1bb-203d-4648-abb2-61a85270418b', 'palais-jad-mahal', 'Palais Jad Mahal', 'Marocain & international / Dîner-spectacle', 'Hivernage', 'Gastronomie et divertissement, spectacles live, cadre somptueux. Soirée glamour assurée.', array['manger', 'sortir']::text[], '', null, '+212 524 436 984', '10 Rue Harroun Errachid, Hivernage', null, array['Spectacle', 'Glamour', 'Dîner']::text[], null, 1019),
  ('91309153-7ed5-4b5d-af8c-269b9dad32c4', 'le-bistro-arabe', 'Le Bistro Arabe', 'Franco-marocain / Bistrot', 'Guéliz', 'Charme d''un bistrot parisien allié aux saveurs marocaines. Couscous 7 légumes, magret de canard au miel.', array['manger']::text[], '', null, '+212 524 433 950', 'Guéliz', '12h–15h & 19h–23h', array['Franco-marocain', 'Cosy', 'Guéliz']::text[], null, 1020),
  ('ea1301e6-6c3c-4266-a414-5dc6a91570f5', 'dar-dar-rooftop', 'Dar Dar Rooftop', 'Marocain contemporain / Rooftop', 'Médina', 'Vue panoramique Koutoubia + toits médina + Atlas. Plats marocains revisités, ingrédients frais locaux.', array['manger', 'sortir']::text[], '', null, '+212 661 230 456', 'Médina', null, array['Rooftop', 'Vue 360°', 'Frais']::text[], null, 1021),
  ('49bb05bf-95f3-453d-a91d-a4f0f602d0e3', 'la-pergola-riad-monceau', 'La Pergola – Riad Monceau', 'Fusion / Terrasse jazz', 'Médina', 'Terrasse splendide avec jazz live, tapas marocains et cocktails sophistiqués. Ambiance unique.', array['manger', 'sortir']::text[], '', null, '+212 524 384 245', 'Riad Monceau, Médina', null, array['Jazz', 'Terrasse', 'Cocktails']::text[], null, 1022),
  ('c4f2332c-4f70-45fc-a61e-03b687b41eb2', 'bacha-coffee', 'Bacha Coffee', 'Café de luxe', 'Médina', 'Dans le Palais Dar Si Said. Croissants amande légendaires, cadre Belle Époque. Attente souvent.', array['manger']::text[], '', null, '+212 524 384 000', 'Palais Dar Si Said, Médina', '10h–18h – Fermé lundi', array['Café', 'Brunch', 'Croissants']::text[], 'top', 1023),
  ('d76c0d98-45c8-4bd5-aa74-5281d6f84281', 'palais-soleiman', 'Palais Soleiman', 'Marocain / Palais XIXe siècle', 'Médina', 'Expérience visuelle autant que gustative dans un palais du XIXe siècle.', array['manger']::text[], '', null, '+212 524 382 125', 'Médina', 'Dîner – Réservation requise', array['Palais', 'Historique', 'Luxe']::text[], null, 1024),
  ('988d1da4-d1b7-4385-a571-408fae72e53d', 'el-fenn-restaurant', 'El Fenn Restaurant', 'Méditerranéen / Hôtel boutique', 'Médina', 'Restaurant de l''hôtel boutique El Fenn, expérience globale de qualité, piscines incluses.', array['manger']::text[], '', null, '+212 524 373 303', 'Derb Moullay Abdullah Ben Hezzian, Médina', null, array['Hôtel boutique', 'Piscine', 'Méditerranéen']::text[], null, 1025),
  ('2e41b2b3-38d3-4dc4-a918-da720d1bfebd', 'azar', 'Azar', 'Fusion marocain-asiatique / Chic', 'Guéliz', 'Restaurant chic proposant une fusion marocaine et asiatique réussie, ambiance feutrée.', array['manger']::text[], '', null, '+212 524 432 020', 'Rue de Yougoslavie, Guéliz', null, array['Fusion', 'Chic', 'Asiatique']::text[], null, 1026),
  ('a8424a3c-fe56-4ff4-ac96-0c096100e243', 'dar-soukkar', 'Dar Soukkar', 'Marocain & international / Spectacle', 'Route de l''Ourika', 'Ancien palais, jardins luxuriants, tajine de poisson + filet bœuf au foie gras. ~600 DH/pers.', array['manger', 'sortir']::text[], '', null, '+212 524 482 000', 'Nouvelle Zone Touristique, Route de l''Ourika', null, array['Palais', 'Spectacle', 'Haut de gamme']::text[], null, 1027),
  ('04dc2f7e-7aab-46bb-aa02-85a7c5f8bce1', 'mandarin-oriental-trois-restaurants', 'Mandarin Oriental – Trois restaurants', 'Gastronomique multi-cuisines', 'Palmeraie', '20ha de palmeraie, 100 000 roses, 3 restaurants d''exception dont marocain et méditerranéen.', array['manger']::text[], '', null, '+212 524 298 888', 'Km 12, Route du Golf Royal, Palmeraie', null, array['Palace', 'Palmeraie', 'Luxe']::text[], null, 1028),
  ('e92af14d-fde6-4451-a601-4b4a34ef24bc', 'la-terrasse-selman-marrakech', 'La Terrasse – Selman Marrakech', 'Gastronomique / Piscine chevaline', 'Palmeraie', 'Déjeuner chic au calme, vue sur les chevaux Pur-sang arabes. Idéal pour business lunch.', array['manger']::text[], '', null, '+212 524 459 600', 'Km 6 Route de l''Ourika, Palmeraie', null, array['Luxe', 'Déjeuner', 'Calme']::text[], null, 1029),
  ('86672404-2a25-4aa0-a34c-730530858491', 'atay-cafe', 'Atay Café', 'Végétarien / Bio', 'Médina', 'Cuisine végane et végétarienne fraîche, méditerranéenne. Jardin sous citronnier. Menu journalier.', array['manger']::text[], '', null, '+212 524 384 108', 'Derb Jama, Médina', '9h–19h – CB +200 DH seulement', array['Végétarien', 'Bio', 'Jardin']::text[], null, 1030),
  ('1aea405b-04c8-43f0-aae3-6567c788c5c2', 'palais-rhoul', 'Palais Rhoul', 'Luxe / Piscine privée', 'Palmeraie', 'Palais en palmeraie, cuisine fine, accès piscine possible. Réservation privative possible.', array['manger']::text[], '', null, '+212 524 329 393', 'Palmeraie de Marrakech', null, array['Palmeraie', 'Privatif', 'Luxe']::text[], null, 1031),
  ('9cdb66d6-1aa5-45fe-a3c0-4301a5743184', 'la-porte-du-monde', 'La porte du monde', 'Salon de thé traditionnel', 'Médina', 'Thé à la menthe, chebakia, décoration inchangée depuis des années. Charme intemporel.', array['manger']::text[], '', null, '+212 664 532 211', 'Médina', null, array['Thé', 'Pâtisseries', 'Intemporel']::text[], null, 1032),
  ('add13df9-c8cb-4854-aba3-e510df9dff57', 'dar-el-bacha-cafe-mamma', 'Dar El Bacha – Café Mamma', 'Café de luxe', 'Médina', 'Magnifique palais XVIIe, terrasse sur patio, petits déjeuners somptueux.', array['manger']::text[], '', null, '+212 524 384 111', '2 Rue Fatima Zahra, Médina', null, array['Palais', 'Petit-déjeuner', 'Brunch']::text[], null, 1033),
  ('c3672104-15a5-4d3b-a30f-65d98dfb3389', 'zwin-zwin-cafe', 'Zwin Zwin Café', 'Café-bar / Rooftop Guéliz', 'Guéliz', 'Terrasse agréable, cocktails, plats légers. Lieu de rendez-vous de la jeunesse branchée.', array['manger', 'sortir']::text[], '', null, '+212 661 439 874', 'Rue Mohammed El Beqal, Guéliz', null, array['Cocktails', 'Terrasse', 'Décontracté']::text[], null, 1034),
  ('6d10d1eb-4ab5-42d9-a0c7-ea5b3066c44d', 'four-seasons-day-pass', 'Four Seasons – Day Pass', 'Piscines rénovées / Hôtel 5★', 'Hivernage', 'Cabanas élégantes, service attentif. Pool Access: 950 MAD. Day Pass déjeuner 3 plats: 1 250 MAD. Wellness (massage 50min inclus): 1 850 MAD.', array['hotels-piscines']::text[], '', null, '+212 524 359 200', 'Avenue Mohammed VI, Hivernage', 'Réservation obligatoire', array['Luxe', 'Cabanas', 'Déjeuner inclus']::text[], 'top', 1035),
  ('58ae87fc-cce2-455a-a6e2-9c2464dc2590', 'es-saadi-palace-day-pass', 'Es Saadi Palace – Day Pass', 'Piscine Lagon + Spa / Palace 5★', 'Hivernage', 'Piscine Lagon chauffée + intérieure. Formule piscine + déjeuner: 850 MAD. Avec spa: 1 000 MAD. Le plus beau pool de l''Hivernage.', array['hotels-piscines']::text[], '', null, '+212 524 337 070', 'Rue Ibrahim El Mazini, Hivernage', 'Ts jours – Réservation requise', array['Lagon', 'Spa inclus option', 'En centre-ville']::text[], 'top', 1036),
  ('431b9837-914d-4151-a1d7-3b8656df36ba', 'park-hyatt-day-pass', 'Park Hyatt – Day Pass', 'Vue Atlas / Piscine chauffée', 'Route d''Amizmiz', '20min du centre, vue Atlas. Day Pass piscine: 1 000 MAD. Piscine + spa: 1 500 MAD. Déjeuner 3 plats inclus.', array['hotels-piscines']::text[], '', null, '+212 524 481 234', 'Km 12 Route d''Amizmiz', 'Réservation obligatoire', array['Vue Atlas', 'Piscine chauffée', 'Déjeuner']::text[], null, 1037),
  ('e4b192a4-67f5-4677-a835-12f9c10ff5cf', 'fairmont-royal-palm-day-pass', 'Fairmont Royal Palm – Day Pass', 'Nature / Golf / Luxe', 'Route de Ouarzazate', 'Niché dans la nature, 1 400 MAD/pers., -50% enfants <12 ans. Piscine principale de 2000 m².', array['hotels-piscines']::text[], '', null, '+212 524 281 000', 'Route de Ouarzazate, Km 12', 'Réservation requise', array['Golf', 'Nature', 'Piscine 2000m²']::text[], null, 1038),
  ('71bb377a-0eb8-44fd-a788-66f3c9c6dce2', 'mandarin-oriental-wellness-day-pass', 'Mandarin Oriental – Wellness Day Pass', 'Palmeraie / 20ha / 5★', 'Palmeraie', 'Massage 30min + déjeuner + accès piscines resort + spa: 1 680 MAD. Palmeraie et 100 000 roses.', array['hotels-piscines']::text[], '', null, '+212 524 298 888', 'Km 12, Route du Golf Royal, Palmeraie', null, array['Palmeraie', 'Wellness', 'Roses']::text[], 'top', 1039),
  ('c334cc34-370f-4d8a-add0-d1745cb52fc8', 'dar-rhizlane-day-pass', 'Dar Rhizlane – Day Pass', 'Palais d''hôtes / Piscine chauffée', 'Hivernage', 'Jardin privé immense. 770 MAD / pers. Mocktail + déjeuner + piscine chauffée + transat. Spa en option.', array['hotels-piscines']::text[], '', null, '+212 524 421 303', 'Av. Jnane El Harti, Hivernage', 'Réservation obligatoire', array['Jardin privé', 'Piscine chauffée', 'Intimiste']::text[], null, 1040),
  ('1fedcb4c-dab4-4f4a-a3c6-7d7f2d9b6fef', 'manzil-la-tortue-day-pass', 'Manzil la Tortue – Day Pass', 'Grande piscine / Bohème', 'Palmeraie', 'Une des plus grandes piscines de Marrakech. 400 DH/pers. Déjeuner 2 plats + transat. Adultes et +12 ans uniquement.', array['hotels-piscines']::text[], '', null, '+212 661 955 517', 'Palmeraie (20min centre)', 'Réservation indispensable – +12 ans', array['Grande piscine', 'Bohème', 'Abordable']::text[], null, 1041),
  ('3714d497-b1b8-4ba0-aa45-aa9b893c1be7', 'les-deux-tours-day-pass', 'Les Deux Tours – Day Pass', 'Palmeraie / Piscine chauffée 29°', 'Palmeraie', 'Cadre enchanteur, cuisine marocaine-française du potager bio. 790 DH/pers. hors boissons.', array['hotels-piscines']::text[], '', null, '+212 524 329 527', 'Palmeraie de Marrakech', 'Réservation indispensable', array['Potager bio', '29°C', 'Palmeraie']::text[], null, 1042),
  ('7e4c061c-a696-458c-afe8-26fc0e9c2148', 'oasis-lodges-day-pass', 'Oasis Lodges – Day Pass', 'Palmeraie / Piscine lagon cascade', 'Palmeraie (Bab Atlas)', 'Piscine lagon chauffée avec cascade. Carte estivale légère. 520 DH/pers., -50% enfants.', array['hotels-piscines', 'famille']::text[], '', null, '+212 665 843 432', 'Palmeraie de Marrakech (Bab Atlas)', null, array['Cascade', 'Lagon', 'Famille']::text[], null, 1043),
  ('64271097-8eb6-4e76-a9a7-b1e8cbdabf18', 'jack-marrakech-day-pass', 'Jack Marrakech – Day Pass', 'Luxe / Ambiance moderne', 'Palmeraie', 'Day Pass exclusif, ambiance luxueuse et contemporaine. Dès 450 MAD.', array['hotels-piscines']::text[], '', null, '+212 524 388 000', 'Palmeraie de Marrakech', null, array['Luxe', 'Moderne', 'Exclusif']::text[], null, 1044),
  ('cbec2e55-a13c-4868-a2bd-db9f29506b64', 'lodge-k-day-pass', 'Lodge K – Day Pass', 'Sérénité / Palmeraie élégante', 'Palmeraie', 'Cadre élégant en palmeraie, sérénité, nature. 988 MAD/pers. Très apprécié des connaisseurs.', array['hotels-piscines']::text[], '', null, '+212 524 388 500', 'Palmeraie de Marrakech', null, array['Palmeraie', 'Sérénité', 'Nature']::text[], null, 1045),
  ('7cd84dad-0fd8-48af-ace8-4ba00f3dd9d8', 'assoufid-golf-resort-day-pass', 'Assoufid Golf Resort – Day Pass', 'Golf / Calme / Discrétion', 'Route de Ouarzazate', 'Atmosphère paisible, environnement soigné, discrétion totale. Accès piscine 11h–18h + déjeuner.', array['hotels-piscines']::text[], '', null, '+212 524 404 750', 'Douar Lahna, Route de Ouarzazate', null, array['Golf', 'Discreet', 'Calme']::text[], null, 1046),
  ('b069f763-d4d0-4982-a991-ef59f788c66e', 'villa-nour-day-pass', 'Villa Nour – Day Pass', 'Médina / Cadre marocain intime', 'Médina', 'Ambiance marocaine authentique, en centre-ville. 400 MAD, déjeuner inclus. Idéal habitants et touristes.', array['hotels-piscines']::text[], '', null, '+212 524 375 000', 'Médina de Marrakech', null, array['Médina', 'Intime', 'Authentique']::text[], null, 1047),
  ('f5941d92-1463-4f07-abf6-68aa5e96a92f', 'eden-lodges-day-pass', 'Eden Lodges – Day Pass', 'Éco-lodge / Palmeraie', 'Palmeraie', 'Piscine + jacuzzi, déjeuner, environnement vert. Ambiance détente et nature.', array['hotels-piscines']::text[], '', null, '+212 524 300 820', 'Palmeraie de Marrakech', null, array['Éco-lodge', 'Jacuzzi', 'Nature']::text[], null, 1048),
  ('bd4d7daf-0263-4041-ae17-18b2264b0f5e', 'palais-celoa-day-pass', 'Palais Celoa – Day Pass', 'Luxe / Repas inclus', 'Palmeraie', 'Repas et cocktail de bienvenue inclus dans le day pass. Cadre palatial.', array['hotels-piscines']::text[], '', null, '+212 524 381 700', 'Palmeraie de Marrakech', null, array['Palatial', 'Cocktail inclus', 'Prestige']::text[], null, 1049),
  ('b04f1de1-579e-405b-ad1f-8185189a2d0b', 'selman-marrakech-piscine', 'Selman Marrakech – Piscine', 'Pur-sang arabes / Luxe suprême', 'Palmeraie', 'Les piscines les plus élégantes de Marrakech, entourées d''écuries de Pur-sang arabes.', array['hotels-piscines']::text[], '', null, '+212 524 459 600', 'Km 6 Route de l''Ourika', null, array['Pur-sang', 'Ultra luxe', 'Sculpture']::text[], 'exclusive', 1050),
  ('e9f4a66c-995b-4435-a998-47ca5add7ac8', 'domaine-de-tameslohte-day-pass', 'Domaine de Tameslohte – Day Pass', 'Nature / Route d''Amizmiz', 'Route d''Amizmiz (30min)', 'Piscine chauffée + déjeuner + spa hammam en option. 400 DH/pers. Escapade hors-ville.', array['hotels-piscines']::text[], '', null, '+212 666 644 580', 'Route d''Amizmiz (30 min de Marrakech)', null, array['Hors-ville', 'Piscine chauffée', 'Spa']::text[], null, 1051),
  ('98d0c398-f0d9-40bd-a13f-70cf86018891', 'inara-camp-agafay-day-pass', 'Inara Camp – Agafay Day Pass', 'Désert d''Agafay / Chic', 'Désert d''Agafay (45min)', 'Parenthèse désert chic, piscine à ciel ouvert face aux plateaux. Unique à Marrakech.', array['hotels-piscines']::text[], '', null, '+212 661 400 180', 'Désert d''Agafay (45min de Marrakech)', null, array['Désert', 'Unique', 'Chic']::text[], 'exclusive', 1052),
  ('adc9243c-03cd-44fb-a3be-94c91071f353', 'la-mamounia', 'La Mamounia', 'Palace mythique 5★★ Luxe', 'Remparts', 'Le palace le plus iconique d''Afrique. Jardins 8ha, 3 restaurants, spa 2500m², piscines chauffées. Réservation plusieurs mois à l''avance.', array['hotels-piscines']::text[], '', 'https://mamounia.com', '+212 524 888 888', 'Avenue Bab Jdid', null, array['Légendaire', 'Jardins 8ha', 'Gastronomie']::text[], 'top', 1053),
  ('423c0cd8-d5b6-4095-a5c4-4e53062aa332', 'royal-mansour-marrakech', 'Royal Mansour Marrakech', 'Palace ultra-luxe 5★★', 'Médina', '53 riads privés sur 3 niveaux. Spa, 3 restaurants, piscines. Construit par ordre royal. Le plus exclusif.', array['hotels-piscines']::text[], '', 'https://royalmansour.com', '+212 529 808 080', 'Rue Abou El Abbas Sebti', null, array['Riads privés', 'Ultra-luxe', 'Royal']::text[], 'exclusive', 1054),
  ('1ce1bd79-6b0b-4d6b-ab64-8d2c844eb6fd', 'mandarin-oriental', 'Mandarin Oriental', 'Resort de luxe 5★', 'Palmeraie', '20ha palmeraie, 65 clés dont 58 villas avec piscine privée. 3 restaurants, spa XXL. 1er MO en Afrique.', array['hotels-piscines']::text[], '', null, '+212 524 298 888', 'Km 12 Route du Golf Royal, Palmeraie', null, array['Palmeraie', 'Villas piscine', 'Spa XXL']::text[], 'top', 1055),
  ('3dd84468-aa0c-48a8-ac37-6bd4fa8f05ad', 'selman-marrakech', 'Selman Marrakech', 'Palace 5★ / Pur-sang arabes', 'Palmeraie', 'Palais palatial, écuries de Pur-sang arabes, piscines majestueuses, restaurant SABO (JF Piège).', array['hotels-piscines']::text[], '', null, '+212 524 459 600', 'Km 6 Route de l''Ourika', null, array['Chevaux', 'Architecture', 'Gastronomie']::text[], 'exclusive', 1056),
  ('2f83cfaa-2bbf-432b-a774-baf4b17ef8ae', 'four-seasons-resort', 'Four Seasons Resort', 'Hôtel de luxe 5★', 'Hivernage', 'Piscines rénovées, service asiatique d''excellence, jardins luxuriants. Idéal pour familles et business.', array['hotels-piscines', 'famille']::text[], '', null, '+212 524 359 200', 'Avenue Mohammed VI, Hivernage', null, array['Service 5★', 'Piscines', 'Familles']::text[], null, 1057),
  ('27b74319-36a1-46ff-a786-efbfa35a917e', 'es-saadi-resort-palace', 'Es Saadi Resort & Palace', 'Palace historique 5★', 'Hivernage', 'Depuis 1952, autour d''un eucalyptus centenaire. Spa Dior Institut, piscine Lagon, jardins sublimes.', array['hotels-piscines']::text[], '', null, '+212 524 337 070', 'Rue Ibrahim El Mazini, Hivernage', null, array['Historique', 'Dior Spa', 'Centre-ville']::text[], 'top', 1058),
  ('6d49d87e-8e6c-4b99-a922-3f0b9d34b1a0', 'fairmont-royal-palm', 'Fairmont Royal Palm', 'Golf resort 5★', 'Route de Ouarzazate', 'Golf 18 trous, piscine 2000m², nature préservée. Idéal pour golfeurs et amateurs de nature.', array['hotels-piscines']::text[], '', null, '+212 524 281 000', 'Route de Ouarzazate, Km 12', null, array['Golf 18T', 'Nature', 'Piscine 2000m²']::text[], null, 1059),
  ('61f57a56-e7b4-438f-a265-961d07904c10', 'park-hyatt-marrakech', 'Park Hyatt Marrakech', 'Hôtel 5★ / Vue Atlas', 'Route d''Amizmiz', 'À 20min du centre, vue Atlas, jardins paysagés, spa, piscine chauffée. Calme et prestige.', array['hotels-piscines']::text[], '', null, '+212 524 481 234', 'Route d''Amizmiz, Km 12', null, array['Vue Atlas', 'Calme', '20min centre']::text[], null, 1060),
  ('cf253f7d-5b1c-45fd-af01-79ff5eca688f', 'el-fenn', 'El Fenn', 'Hôtel boutique 5★', 'Médina', 'Boutique-hôtel de charme en médina, 28 chambres, 4 piscines, rooftop, art contemporain marocain.', array['hotels-piscines']::text[], '', null, '+212 524 373 303', 'Derb Moullay Abdullah Ben Hezzian, Médina', null, array['Boutique', 'Art', '4 piscines']::text[], 'top', 1061),
  ('12938fdd-8bd0-44f4-ab35-3db97b2f033d', 'riad-palais-delia', 'Riad Palais Délia', 'Riad 5★ / Jardins', 'Médina', 'Proche Jardin Majorelle, 4 chambres, spa hammam, piscine chauffée avec solarium. Ultra-intime.', array['hotels-piscines']::text[], '', null, '+212 524 374 400', 'Médina, près du Jardin Majorelle', null, array['Intimiste', 'Proche Majorelle', 'Spa']::text[], null, 1062),
  ('d516e672-3e18-433c-ac0c-e91b639125fa', 'dar-rhizlane', 'Dar Rhizlane', 'Palais d''hôtes de charme', 'Hivernage', 'Jardin immense et privé, piscine chauffée, spa, accueil chaleureux. Idéal long séjour.', array['hotels-piscines']::text[], '', null, '+212 524 421 303', 'Av. Jnane El Harti, Hivernage', null, array['Jardin privé', 'Charme', 'Spa']::text[], null, 1063),
  ('30187061-1712-4713-aa2e-49bf9d2a22d2', 'les-deux-tours', 'Les Deux Tours', 'Riad-palais 5★ Palmeraie', 'Palmeraie', 'Palmeraie, potager bio, piscine chauffée 29°, restauration marocaine-française de qualité.', array['hotels-piscines']::text[], '', null, '+212 524 329 527', 'Palmeraie de Marrakech', null, array['Potager bio', 'Palmeraie', 'Piscine 29°']::text[], null, 1064),
  ('060d8929-9512-46cf-a44d-0c3eda021048', 'assoufid-golf-spa', 'Assoufid Golf & Spa', 'Golf resort 5★', 'Route de Ouarzazate', 'Golf, spa, piscine, nature. Discrétion et calme absolu, à 10min du centre-ville.', array['hotels-piscines']::text[], '', null, '+212 524 404 750', 'Douar Lahna, Route de Ouarzazate', null, array['Golf', 'Spa', 'Discrétion']::text[], null, 1065),
  ('6355aa84-82c5-4326-a34c-f416985485d7', 'la-brillante', 'La Brillante', 'Boutique hôtel / Rooftop', 'Médina', 'Rooftop La Pergola, cuisine méditerranéenne saine, vue médina et sunset. Ambiance cosy.', array['hotels-piscines']::text[], '', null, '+212 524 384 300', 'Médina', null, array['Rooftop', 'Boutique', 'Médina']::text[], null, 1066),
  ('bab46c89-3cba-421f-a489-c787ff81eb09', 'riad-monceau', 'Riad Monceau', 'Riad de charme / Jazz', 'Médina', 'Jazz live en terrasse, tapas marocains, verdure luxuriante. Expérience culturelle unique.', array['hotels-piscines']::text[], '', null, '+212 524 384 245', 'Médina', null, array['Jazz', 'Terrasse', 'Végétal']::text[], null, 1067),
  ('f4950c20-41f8-444a-a663-7d9e38f117b9', 'kasbah-tamadot-virgin', 'Kasbah Tamadot – Virgin', 'Kasbah de luxe / Atlas', 'Asni (Atlas)', 'Propriété de Richard Branson dans les montagnes de l''Atlas. 1h de Marrakech, expérience unique.', array['hotels-piscines']::text[], '', null, '+212 524 368 200', 'Asni, Haut-Atlas (1h de Marrakech)', null, array['Atlas', 'Virgin', 'Unique']::text[], 'exclusive', 1068),
  ('6ecf6279-bc09-4f69-ac4a-eb6e3b05daf9', 'palais-namaskar', 'Palais Namaskar', 'Palace spa éco-luxe', 'Palmeraie', 'Villas avec piscine privée, spa ayurvédique, palmiers, sérénité absolue.', array['hotels-piscines']::text[], '', null, '+212 524 299 800', 'Route de Bab Atlas, Palmeraie', null, array['Ayurvédique', 'Villas privées', 'Spa']::text[], null, 1069),
  ('02f00485-c074-488f-aac3-5ebed0ed58bf', 'palais-rhoul-2', 'Palais Rhoul', 'Maison d''hôtes de luxe', 'Palmeraie', 'Privatisation possible, cuisine fine, piscine, authenticité marocaine. Expérience exclusive.', array['hotels-piscines']::text[], '', null, '+212 524 329 393', 'Palmeraie de Marrakech', null, array['Privatisation', 'Maison d''hôtes', 'Exclusif']::text[], null, 1070),
  ('c1ab495a-379d-4128-a8ce-e1a898bf4d3d', 'dr-mourhit-jebar', 'Dr. Mourhit Jebar', 'Médecin généraliste / Gériatre', 'Guéliz', 'Centre MJ Médical. Médecin de famille, gériatre, médecin assermenté. Cadre chaleureux.', array['sante']::text[], '', null, '+212 524 431 855', 'Centre MJ Médical, Marrakech', null, array['Généraliste', 'Gériatrie', 'Assermenté']::text[], 'top', 1071),
  ('76b0ca1e-3a23-4838-ad4b-4adfa168436e', 'dr-beatrice-pfiffer', 'Dr. Beatrice Pfiffer', 'Médecin généraliste francophone', 'Médina', 'Médecin francophone, idéale pour les expatriés. Consultations en français.', array['sante']::text[], '', null, '+212 524 431 233', '10 Rue Oued El Makhazine, Médina', null, array['Francophone', 'Expats', 'Généraliste']::text[], null, 1072),
  ('05033ad3-8548-4ae3-abad-1636c572582e', 'dr-najib-ammour', 'Dr. Najib Ammour', 'Médecin généraliste', 'Médina', 'Médecin généraliste expérimenté en médina, consultations rapides.', array['sante']::text[], '', null, '+212 524 388 750', '30 Rue Sidi Boulaabada, Médina', null, array['Généraliste', 'Médina', 'Disponible']::text[], null, 1073),
  ('047c4603-6b6c-4b14-a3a8-d70f2927c1be', 'dr-ahmed-arrad', 'Dr. Ahmed Arrad', 'Médecin généraliste', 'Médina', 'Cabinet centralement situé, consultations sans rendez-vous souvent possibles.', array['sante']::text[], '', null, '+212 524 380 440', '45 Rue Bab Agnaou, Médina', null, array['Généraliste', 'Centre', 'Sans RDV']::text[], null, 1074),
  ('436d7927-5064-41d9-a281-2bf68853a57e', 'dr-siham-bennis', 'Dr. Siham Bennis', 'Généraliste / Diabétologue', 'Guéliz', 'Spécialisée en diabétologie et nutrition en plus de la médecine générale. Très recommandée.', array['sante']::text[], '', null, '+212 524 313 990', 'Av. Allal El Fassi, Complexe des Habous, Guéliz', null, array['Diabétologie', 'Nutrition', 'Recommandée']::text[], null, 1075),
  ('6034f8a2-308e-4bd5-a261-24f094b3f168', 'clinique-internationale-de-marrakech', 'Clinique Internationale de Marrakech', 'Clinique privée multi-spécialités', 'Guéliz', 'Clinique de référence, urgences 24h/24, cardiologie, chirurgie, maternité. Accès rapide.', array['sante']::text[], '', null, '+212 524 435 659', 'Rue de Yougoslavie, Guéliz', null, array['Urgences 24h', 'Multi-spécialités', 'Référence']::text[], 'top', 1076),
  ('6cba5bd3-3636-4fb8-a3c5-a100b85855b8', 'clinique-du-palmier', 'Clinique du Palmier', 'Clinique privée', 'Guéliz', 'Clinique privée moderne, chirurgie, urgences, consultations spécialisées. Bien équipée.', array['sante']::text[], '', null, '+212 524 309 309', 'Rue Moulay Ali, Guéliz', null, array['Clinique', 'Chirurgie', 'Moderne']::text[], null, 1077),
  ('3f45909b-5599-46c1-a1b2-c02dbabef4c9', 'polyclinique-du-sud', 'Polyclinique du Sud', 'Polyclinique / Urgences', 'Guéliz', 'Grande polyclinique, plateau technique complet, urgences 24h/24, maternité.', array['sante']::text[], '', null, '+212 524 447 999', '2 Rue de Yougoslavie, Guéliz', null, array['Urgences', 'Maternité', 'Plateau complet']::text[], null, 1078),
  ('e9464d02-2375-4e93-a931-0fb8b47976d8', 'dr-nadia-bensouda', 'Dr. Nadia Bensouda', 'Gynécologue-obstétricienne', 'Guéliz', 'Gynécologue de référence pour les expatriées. Francophone, très disponible.', array['sante']::text[], '', null, '+212 524 437 280', 'Guéliz', null, array['Gynéco', 'Francophone', 'Expats']::text[], null, 1079),
  ('b96cf727-d38b-4ea9-a983-04ea6f5ccf0a', 'dr-hassan-el-alaoui', 'Dr. Hassan El Alaoui', 'Cardiologue', 'Guéliz', 'Cardiologue renommé, ECG, échocardiographie. Consultations en français et arabe.', array['sante']::text[], '', null, '+212 524 433 800', 'Guéliz, Marrakech', null, array['Cardiologue', 'ECG', 'Echo']::text[], null, 1080),
  ('c986cfa4-2487-459a-a6bf-7f591ffb8a23', 'dr-lalla-zahra-benali', 'Dr. Lalla Zahra Benali', 'Pédiatre', 'Guéliz', 'Pédiatre de confiance pour familles expatriées. Consultations en français, disponible rapidement.', array['sante', 'famille']::text[], '', null, '+212 524 431 240', 'Guéliz', null, array['Pédiatre', 'Familles', 'Francophone']::text[], null, 1081),
  ('04c70aac-8e30-46d5-a37e-83654832b3c5', 'dr-mohammed-errafiq', 'Dr. Mohammed Errafiq', 'Ophtalmologue', 'Guéliz', 'Ophtalmologue expérimenté, lunettes, lentilles, pathologies oculaires. Équipement moderne.', array['sante']::text[], '', null, '+212 524 432 600', 'Guéliz', null, array['Yeux', 'Lunettes', 'Moderne']::text[], null, 1082),
  ('d8ff87e6-568b-469b-aa40-e182159e8802', 'dr-fatima-zouine', 'Dr. Fatima Zouine', 'Dermatologue', 'Guéliz', 'Dermatologue très appréciée, soins anti-âge, pathologies cutanées. Consultation rapide.', array['sante']::text[], '', null, '+212 524 435 880', 'Guéliz', null, array['Dermato', 'Anti-âge', 'Cutané']::text[], null, 1083),
  ('48cbeb7e-f57e-4168-a6b4-7a8f506c8fff', 'dr-abdellatif-kabbaj', 'Dr. Abdellatif Kabbaj', 'Orthopédiste-traumatologue', 'Guéliz', 'Traumatologue de référence. Fractures, genoux, rachis. Consultations en français.', array['sante']::text[], '', null, '+212 524 434 900', 'Guéliz', null, array['Orthopédie', 'Trauma', 'Genoux']::text[], null, 1084),
  ('c3e1be46-fb28-4d82-a4b0-bf705ef58336', 'dr-youssef-el-mansouri', 'Dr. Youssef El Mansouri', 'ORL (Oto-rhino-laryngologiste)', 'Guéliz', 'ORL compétent, audiologie, sinusite, troubles auditifs. Rapide et efficace.', array['sante']::text[], '', null, '+212 524 432 100', 'Guéliz', null, array['ORL', 'Audition', 'Sinusite']::text[], null, 1085),
  ('d1c3c900-42af-495e-a6d9-3cb5418b8b62', 'dr-rachid-ouali', 'Dr. Rachid Ouali', 'Pneumologue / Allergologue', 'Guéliz', 'Allergies, asthme, pneumologie. Fait partie des meilleurs spécialistes de la ville.', array['sante']::text[], '', null, '+212 524 433 400', 'Guéliz', null, array['Allergo', 'Asthme', 'Pneumo']::text[], null, 1086),
  ('dd651ceb-2076-43fc-a0e9-84183bba7ea1', 'dr-amina-senhaji', 'Dr. Amina Senhaji', 'Endocrinologue / Nutritionniste', 'Guéliz', 'Diabète, thyroïde, nutrition, surpoids. Approche globale et bienveillante.', array['sante']::text[], '', null, '+212 524 431 900', 'Guéliz', null, array['Endocrino', 'Thyroïde', 'Nutrition']::text[], null, 1087),
  ('da9a4f90-6167-4414-a706-fa6362aecc51', 'institut-pasteur-laboratoire', 'Institut Pasteur – Laboratoire', 'Laboratoire d''analyses', 'Guéliz', 'Laboratoire de référence nationale. Analyses sanguines, bactériologie, virologie. Résultats rapides.', array['sante']::text[], '', null, '+212 524 436 100', 'Guéliz', null, array['Labo', 'Analyses', 'Référence']::text[], 'top', 1088),
  ('232f7a22-04b5-4f97-a75c-6b87ec5683a4', 'sos-medecins-marrakech', 'SOS Médecins Marrakech', 'Urgences médicales à domicile', 'Toute la ville', 'Médecins de garde 24h/24, 7j/7. Déplacement à domicile rapide. Indispensable.', array['sante']::text[], '', null, '+212 524 404 040', 'Toute la ville de Marrakech', null, array['Urgence domicile', '24h/24', 'Garde']::text[], 'top', 1089),
  ('3f1df19d-bc48-4592-a923-59c647a1e76e', 'dr-khadija-tazi', 'Dr. Khadija Tazi', 'Psychiatre / Psychothérapeute', 'Guéliz', 'Psychiatre francophone, thérapies cognitivo-comportementales, gestion stress et anxiété.', array['sante']::text[], '', null, '+212 524 438 700', 'Guéliz', null, array['Psychiatrie', 'TCC', 'Francophone']::text[], null, 1090),
  ('901eced3-5819-4706-a9b1-f969f837d050', 'dr-karim-benali', 'Dr. Karim Benali', 'Dentiste / Chirurgien dentiste', 'Guéliz', 'Dentiste de référence pour expats, soins complets, implants, orthodontie légère.', array['sante']::text[], '', null, '+212 524 431 500', 'Guéliz', null, array['Implants', 'Francophone', 'Expats']::text[], 'top', 1091),
  ('72633f4e-3fed-4669-ac03-f6aab203ee60', 'dr-meriem-lahcen', 'Dr. Meriem Lahcen', 'Dentiste / Esthétique dentaire', 'Guéliz', 'Spécialiste en esthétique dentaire, blanchiment, facettes. Cabinet moderne et propre.', array['sante']::text[], '', null, '+212 524 437 800', 'Guéliz', null, array['Esthétique', 'Blanchiment', 'Moderne']::text[], null, 1092),
  ('7504f9f7-7a21-4ab5-aacb-0905f3fdcb23', 'dr-omar-benchekroun', 'Dr. Omar Benchekroun', 'Orthodontiste', 'Guéliz', 'Orthodontiste expérimenté, appareil dentaire enfants et adultes, aligneurs invisibles.', array['sante', 'famille']::text[], '', null, '+212 524 433 250', 'Guéliz', null, array['Orthodontie', 'Adultes', 'Enfants']::text[], null, 1093),
  ('4582f126-dbea-4a4d-aac5-742304459895', 'cabinet-dentaire-du-centre', 'Cabinet Dentaire du Centre', 'Cabinet dentaire', 'Médina', 'Cabinet bien situé en médina, soins courants, disponibilité correcte, tarifs raisonnables.', array['sante']::text[], '', null, '+212 524 385 200', 'Médina', null, array['Médina', 'Accessible', 'Tarifs raisonnables']::text[], null, 1094),
  ('34bcffb4-b434-4eda-a0b9-1a03d7a61337', 'dr-youssef-tahiri', 'Dr. Youssef Tahiri', 'Chirurgien dentiste / Implantologie', 'Guéliz', 'Expert en implantologie et chirurgie orale. Très bien équipé, stérilisation rigoureuse.', array['sante']::text[], '', null, '+212 524 435 100', 'Guéliz', null, array['Implantologie', 'Chirurgie', 'Rigoureux']::text[], null, 1095),
  ('ecfec390-296d-47b7-a23a-387adab4ddc3', 'dr-soumia-nasr', 'Dr. Soumia Nasr', 'Pédodontiste (dentiste enfants)', 'Guéliz', 'Spécialiste dentaire pour enfants, approche ludique et douce. Très bien notée par les familles.', array['sante', 'famille']::text[], '', null, '+212 524 432 800', 'Guéliz', null, array['Enfants', 'Doux', 'Famille']::text[], null, 1096),
  ('385693da-5540-476c-aeb7-64894744a3d6', 'clinique-dentaire-majorelle', 'Clinique Dentaire Majorelle', 'Clinique dentaire multi-praticiens', 'Guéliz (Majorelle)', 'Équipe complète en un lieu : généraliste, orthodontiste, paro. Réservation en ligne.', array['sante']::text[], '', null, '+212 524 434 600', 'Quartier Majorelle, Guéliz', null, array['Clinique complète', 'Majorelle', 'Rdv en ligne']::text[], null, 1097),
  ('6f76f9a2-e733-4dd4-a0b8-c6b5ac7eafd8', 'dr-laila-benkirane', 'Dr. Laila Benkirane', 'Dentiste généraliste', 'M''Hamid', 'Cabinet de quartier accessible, tarifs raisonnables, bon accueil, attente limitée.', array['sante']::text[], '', null, '+212 524 496 800', 'M''Hamid, Marrakech', null, array['M''Hamid', 'Accessible', 'Sans RDV']::text[], null, 1098),
  ('fe62c553-ab02-483f-a2dc-08d55f835c8b', 'pharmacie-de-garde-marrakech', 'Pharmacie de Garde Marrakech', 'Pharmacies de garde (numéro central)', 'Toute la ville', 'Numéro pour connaître la pharmacie de garde la nuit et week-ends. Toujours noter ce numéro.', array['sante']::text[], '', null, '+212 524 430 450', 'Numéro central Marrakech', null, array['Garde', '24h', 'Urgence']::text[], 'top', 1099),
  ('c3912d6f-edb5-4f06-af64-e338da0eae2d', 'pharmacie-atlas-gueliz', 'Pharmacie Atlas – Guéliz', 'Pharmacie centrale', 'Guéliz', 'Grande pharmacie bien stockée, pharmaciens francophones, conseil de qualité.', array['sante']::text[], '', null, '+212 524 431 122', 'Boulevard Mohammed V, Guéliz', '8h–22h', array['Bien stockée', 'Guéliz', 'Conseil']::text[], null, 1100),
  ('2e8a8eb1-6674-4d7c-a4ce-a29af6833b87', 'pharmacie-de-la-koutoubia', 'Pharmacie de la Koutoubia', 'Pharmacie centrale Médina', 'Médina', 'La mieux placée en médina, accessible aux touristes, anglophone et francophone.', array['sante']::text[], '', null, '+212 524 385 800', 'Près de la Koutoubia, Médina', null, array['Médina', 'Centrale', 'Accessible']::text[], null, 1101),
  ('ff298346-7fb5-414f-a13e-469b9d53b930', 'pharmacie-al-azhar', 'Pharmacie Al Azhar', 'Pharmacie de quartier', 'Massira 3', 'Pharmacie de proximité, bonne disponibilité des médicaments courants.', array['sante']::text[], '', null, '+212 524 496 600', 'Av. Moutanabi, Massira 3', null, array['Massira', 'Proximité', 'Disponible']::text[], null, 1102),
  ('78a422d7-9ef8-4aed-a4e3-f43ee7a8a733', 'pharmacie-majorelle', 'Pharmacie Majorelle', 'Pharmacie haut de gamme', 'Guéliz (Majorelle)', 'Pharmacie haut de gamme, cosmétique, parapharmacie, conseils en dermatologie et nutrition.', array['sante']::text[], '', null, '+212 524 433 300', 'Quartier Majorelle, Guéliz', null, array['Parapharmacie', 'Cosmétique', 'Conseil']::text[], null, 1103),
  ('10f82b02-0edd-4fec-a6e3-55754eea3320', 'pharmacie-hivernage', 'Pharmacie Hivernage', 'Pharmacie de nuit', 'Hivernage', 'Horaires élargis, garde fréquente, idéale pour les hôtels de l''Hivernage.', array['sante']::text[], '', null, '+212 524 436 500', 'Hivernage, Marrakech', null, array['Nuit', 'Hivernage', 'Garde']::text[], null, 1104),
  ('fb79da2c-74ba-4182-ab82-2fd264a93112', 'samu-urgences-medicales', 'SAMU / Urgences médicales', 'Numéro national urgences médicales', 'National', 'Numéro national marocain. Pour urgences vitales. SAMU disponible 24h/24.', array['urgences']::text[], '', null, '15 / 141', 'National – composez 15 ou 141', null, array['SAMU', 'Vital', 'National']::text[], 'top', 1105),
  ('138ac394-deec-4b44-a260-269fa581a9ef', 'police-secours', 'Police Secours', 'Police', 'National', 'Police nationale. En cas d''urgence, agression, accident.', array['urgences']::text[], '', null, '19', 'Commissariat central: Place Djemaa El Fna', null, array['Police', 'Urgence']::text[], null, 1106),
  ('a883bfce-4ae7-4e15-a946-45630ce52575', 'pompiers-marrakech', 'Pompiers Marrakech', 'Sapeurs-pompiers', 'Marrakech', 'Incendie, accidents de la route, sauvetage. Réponse rapide dans la ville.', array['urgences']::text[], '', null, '15', 'Boulevard Mohammed V, Marrakech', null, array['Incendie', 'Accident', 'Sauvetage']::text[], null, 1107),
  ('9d544c06-2ccb-41a4-a548-8a42593cb63f', 'urgences-chu-mohammed-vi', 'Urgences CHU Mohammed VI', 'Centre hospitalier universitaire', 'M''Hamid', 'Le plus grand hôpital public, urgences 24h/24, trauma, maternité, pédiatrie.', array['urgences']::text[], '', null, '+212 524 303 030', 'Quartier M''Hamid, Marrakech', null, array['Public', '24h', 'Trauma']::text[], null, 1108),
  ('e55e2f4a-4a22-470b-a40c-907ecdaa1d85', 'consulat-de-france-a-marrakech', 'Consulat de France à Marrakech', 'Consulat / Assistance aux ressortissants', 'Guéliz', 'Assistance aux ressortissants français en difficulté, perte de documents, urgences.', array['urgences']::text[], '', null, '+212 524 389 500', '1 Rue Ibn Khaldoun, Guéliz', null, array['France', 'Ressortissants', 'Documents']::text[], null, 1109),
  ('61751df7-e5b0-411e-a73f-50d8fc004ae5', 'depannage-eau-radeema', 'Dépannage Eau / RADEEMA', 'Régie eau et électricité', 'Toute la ville', 'Pannes d''eau, électricité, urgences réseaux. Service d''urgence technique Marrakech.', array['urgences']::text[], '', null, '+212 524 438 181', 'Marrakech', 'Urgences 24h', array['Eau', 'Électricité', 'Réseau']::text[], null, 1110),
  ('a24332d0-921d-40af-ae44-6df91ba5a72a', 'christian-gilles-salon', 'Christian Gilles Salon', 'Salon de coiffure / Beauté haut de gamme', 'Guéliz', '260m², design contemporain. Marques: Kérastase, L''Oréal, Sothys, Peggy Sage. Cabines privatives. Dirigé par Rajaa.', array['beaute']::text[], '', 'https://christiangillesmarrakech.com', '+212 524 449 426', '32 Rue Ibn Atya, Guéliz', null, array['Haut de gamme', 'Cabines privées', 'Kérastase']::text[], 'top', 1111),
  ('e6dce51e-0c59-4534-a44f-29bf364c8619', 'beauty-lab-marrakech', 'Beauty Lab Marrakech', 'Bar à brushing / Wavy hair', 'Guéliz', 'Spécialiste du brushing et wavy hair depuis 2018. Produits Christophe Robin, John Masters Organics. Très coté.', array['beaute']::text[], '', null, '+212 689 022 885', 'Résidence Ezzahiria 2, Guéliz', null, array['Brushing', 'Wavy', 'Produits premium']::text[], 'top', 1112),
  ('067a82a0-b496-400f-ac19-14e70288e46f', '7eme-sens-institut', '7ème Sens Institut', 'Institut beauté complet', 'Guéliz', 'Guéliz centre. Coiffure, esthétique, onglerie, massages et hammam. Ouvert 7j/7. Accueillant.', array['beaute', 'bien-etre-sport']::text[], '', null, '+212 689 022 885', 'Résidence Ezzahiria 2, Guéliz', null, array['Complet', '7j/7', 'Hammam']::text[], null, 1113),
  ('fbf2935d-cf83-44cf-ab54-9a2755990b83', 'zine-o-zine-salon-spa', 'Zine O Zine Salon & Spa', 'Salon / Spa / Hammam', 'Guéliz', 'Hammam exceptionnel, extensions cheveux, coloration avec Amin, épilation, esthétique. Très bien noté sur Google.', array['beaute', 'bien-etre-sport']::text[], '', 'https://zineozine.com', '+212 661 339 812', 'Guéliz, Marrakech', null, array['Hammam', 'Extensions', 'Top avis']::text[], 'top', 1114),
  ('dffb47d6-5f2c-4b03-a7c2-346039b524dc', 'madame-fk-salon', 'Madame FK Salon', 'Salon moderne / Nashi', 'Guéliz', 'Nouveau salon prometteur, soins capillaires Nashi, soins peau Medicare. Modern et accessible.', array['beaute']::text[], '', null, '+212 661 200 100', 'Guéliz', null, array['Nashi', 'Moderne', 'Nouveau']::text[], null, 1115),
  ('4d9e9082-4ecc-432f-aa72-afd19a2fdc7d', 'zinaya-spa-hammam', 'Zinaya Spa & Hammam', 'Hammam turc / Spa 800m²', 'Targa', '800m², hammam turc, massages, jacuzzi, salon de coiffure et beauté. Élégant et relaxant.', array['beaute', 'bien-etre-sport']::text[], '', 'https://spa-zinaya.com', '+212 524 431 800', 'Bassatine Targa, face mosquée, Marrakech', null, array['Hammam turc', 'Jacuzzi', '800m²']::text[], null, 1116),
  ('553c04ad-ff16-4b7e-aacf-af498506fc58', 'les-bains-de-marrakech', 'Les Bains de Marrakech', 'Spa / Hammam traditionnel', 'Médina', 'Palace 1800m² dédié au bien-être. Décoration raffinée, massages, hammam. Très renommé.', array['beaute', 'bien-etre-sport']::text[], '', null, '+212 524 381 428', '2 Derb El Cadi, Médina', null, array['Hammam', '1800m²', 'Prestige']::text[], null, 1117),
  ('7ef466f3-3c62-45f5-ab31-a151d79d657e', 'hammam-de-la-rose', 'Hammam de la Rose', 'Hammam / Spa authentique', 'Médina', 'Sanctuaire pour le corps et l''esprit. Hammam traditionnel + massages + soins beauté.', array['beaute', 'bien-etre-sport']::text[], '', null, '+212 524 387 233', '35 Derb El Arsa, Médina', null, array['Traditionnel', 'Sanctuaire', 'Soins']::text[], null, 1118),
  ('42b218d0-6968-475d-a04b-b02da506584a', 'spa-de-la-mamounia', 'Spa de La Mamounia', 'Spa ultra-luxe / 2500m²', 'Remparts', 'Valmont, Augustinus Bader, marocMaroc. 2 hammams tradi + 1 privé, 10 cabines, piscine chauffée. Le plus luxueux.', array['beaute', 'bien-etre-sport']::text[], '', null, '+212 524 888 888', 'Avenue Bab Jdid', null, array['Ultra-luxe', '2500m²', 'Valmont']::text[], 'exclusive', 1119),
  ('24f04409-6cc6-4272-a873-b3f8a71c4698', 'spa-es-saadi-dior-institut', 'Spa Es Saadi – Dior Institut', 'Spa palace / Dior Institut', 'Hivernage', 'Soins Dior Institut, eucalyptus centenaire, thermes orientaux, yoga. Reconnexion corps-esprit.', array['beaute', 'bien-etre-sport']::text[], '', null, '+212 524 337 070', 'Rue Ibrahim El Mazini, Hivernage', null, array['Dior Institut', 'Yoga', 'Oriental Thermae']::text[], 'top', 1120),
  ('a0c2960f-b566-40ae-a313-4574565b6bdc', 'hammam-paradis', 'Hammam Paradis', 'Hammam romantique', 'Médina (Mouassine)', '8 salles privées, parfait pour couples. Hammam, massages, cuisine avant/après. Très romantique.', array['beaute', 'bien-etre-sport']::text[], '', null, '+212 524 386 800', '91 Derb Habib Allah, Mouassine, Médina', null, array['Couple', 'Privé', '8 salles']::text[], null, 1121),
  ('4a75fc4e-bedf-4378-acf2-7d45cb80f31b', 'hammam-rosa-bonheur', 'Hammam Rosa Bonheur', 'Hammam authentique / Historique', 'Médina', 'Authentique hammam, expérience locale vraie, public mixte parfois. XVIe siècle, charme inégalé.', array['beaute', 'bien-etre-sport']::text[], '', null, '+212 688 633 334', 'Rahba Lakdima, Médina', null, array['Authentique', 'Historique', 'XVIe siècle']::text[], null, 1122),
  ('673d3edc-8679-40d2-a030-15e6dff775fc', 'assoufid-golf-club', 'Assoufid Golf Club', 'Golf 18 trous', 'Route de Ouarzazate', 'Golf 18 trous, paysage exceptionnel, accès visiteurs, green fees raisonnables.', array['bien-etre-sport']::text[], '', null, '+212 524 404 750', 'Route de Ouarzazate, Km 10', null, array['Golf', '18 trous', 'Visiteurs']::text[], null, 1123),
  ('ff0f9192-9fac-4da1-a649-8e4e4e05be5b', 'golf-d-al-maaden', 'Golf d''Al Maaden', 'Golf 18 trous / Alison Golf', 'Sidi Youssef Ben Ali', 'Golf conçu par Kyle Phillips. Parcours exigeant, green fees corrects. Brasserie Tfaya sur place.', array['bien-etre-sport']::text[], '', null, '+212 524 404 500', 'Al Maaden, Sidi Youssef Ben Ali', null, array['Golf', 'Kyle Phillips', 'Restaurant']::text[], null, 1124),
  ('76b17365-9253-4c71-a3b3-5bc0bbea702e', 'golf-royal-de-marrakech', 'Golf Royal de Marrakech', 'Golf 18 trous / Royal', 'Palmeraie', 'L''un des plus anciens golfs du Maroc. Adjacent au Mandarin Oriental. Palmiers centenaires.', array['bien-etre-sport']::text[], '', null, '+212 524 409 800', 'Route du Golf Royal, Palmeraie', null, array['Golf Royal', 'Palmiers', 'Historique']::text[], null, 1125),
  ('2b3046d6-b32f-4097-a20e-a13c4a70d20f', 'palmeraie-golf-palace', 'Palmeraie Golf Palace', 'Golf 18 trous / Resort', 'Palmeraie', 'Golf en palmeraie, resort complet, piscine, accessible aux visiteurs sur réservation.', array['bien-etre-sport']::text[], '', null, '+212 524 301 010', 'Palmeraie de Marrakech', null, array['Golf', 'Palmeraie', 'Resort']::text[], null, 1126),
  ('838df864-df73-4b85-a189-f02e217df04f', 'keep-cool-fitness-gueliz', 'Keep Cool Fitness – Guéliz', 'Salle de sport moderne', 'Guéliz', 'Grande salle de sport moderne, équipements cardio et musculation, cours collectifs, piscine.', array['bien-etre-sport']::text[], '', null, '+212 524 431 800', 'Guéliz, Marrakech', '6h–22h', array['Cardio', 'Musculation', 'Cours']::text[], null, 1127),
  ('ba0e65e9-d00e-4c21-ae3c-45774d857104', 'california-gym-marrakech', 'California Gym Marrakech', 'Salle de gym / Piscine', 'Hivernage', 'Gym réputée, piscine, squash, cours collectifs. Abonnements mensuel et annuel.', array['bien-etre-sport']::text[], '', null, '+212 524 434 424', 'Hivernage, Marrakech', null, array['Piscine', 'Squash', 'Abonnement']::text[], null, 1128),
  ('74c7d190-be0a-4643-aa6e-ba13b68d44ad', 'marrakech-yoga-studio', 'Marrakech Yoga Studio', 'Yoga / Méditation', 'Guéliz', 'Studio de yoga bien-être, cours Hatha, Vinyasa et Yin. Ambiance chaleureuse, profs francophones.', array['bien-etre-sport']::text[], '', null, '+212 661 234 567', 'Guéliz', null, array['Yoga', 'Méditation', 'Francophone']::text[], null, 1129),
  ('25d57ff1-c7c8-4688-a251-12538ef5f257', 'padel-marrakech-club', 'Padel Marrakech Club', 'Padel / Tennis / Loisirs', 'Palmeraie', 'Courts de padel couverts et ouverts, location de raquettes, tournois. En fort développement.', array['bien-etre-sport']::text[], '', null, '+212 661 567 890', 'Palmeraie de Marrakech', null, array['Padel', 'Tennis', 'Tournois']::text[], null, 1130),
  ('e1cf4e91-a5b1-4738-a18a-8fc8a96f9884', 'atelier-du-cuir-ain-azliten', 'Atelier du Cuir – Ain Azliten', 'Maroquinerie artisanale authentique', 'Médina', 'Cuirs tannés naturellement, sacs, babouches sur-mesure. Visite des tanneries possible.', array['shopping']::text[], '', null, '+212 524 377 120', 'Derb Ain Azliten, Médina', null, array['Cuir', 'Sur-mesure', 'Tanneries']::text[], null, 1131),
  ('e273a9ee-4250-4cff-ae07-0b27c942a3bb', '33-rue-majorelle', '33 Rue Majorelle', 'Concept store design marocain', 'Guéliz (Majorelle)', 'Épicerie fine, épices, décoration, cosmétiques naturels. Design marocain contemporain raffiné.', array['shopping']::text[], '', null, '+212 524 314 195', '33 Rue Majorelle, Guéliz', null, array['Design', 'Épices', 'Cosmétiques']::text[], 'top', 1132),
  ('b0f9ad56-3c70-42cb-a91e-fd303001e7b8', 'ensemble-artisanal-de-marrakech', 'Ensemble Artisanal de Marrakech', 'Artisanat officiel / Prix fixes', 'Médina', 'Prix officiels sans négociation. Poterie, zellige, cuir, bois. Idéal pour achats sûrs.', array['shopping']::text[], '', null, '+212 524 386 758', 'Rue de la Mouassine, Médina', null, array['Prix fixes', 'Officiel', 'Artisanat']::text[], null, 1133),
  ('facf7ab2-18f5-413d-a367-f907332e1aa5', 'ministero-del-gusto', 'Ministero del Gusto', 'Concept store luxe / Design', 'Médina', 'Galerie-boutique unique de Fabrizio Bizzarri. Objets rares, meubles, mode, art. Expérience unique.', array['shopping']::text[], '', null, '+212 524 426 455', '22 Derb Azzouz, Médina', null, array['Luxe', 'Galerie', 'Unique']::text[], 'exclusive', 1134),
  ('8f754162-0c90-48ee-a3d6-7e661b63e187', 'souk-semmarine', 'Souk Semmarine', 'Souk principal / Artisanat', 'Médina', 'Le souk principal de Marrakech. Tapis, épices, bijoux, cuir, poterie. Négociation nécessaire.', array['shopping']::text[], '', null, '+212 524 386 000', 'Souk Semmarine, Médina', null, array['Souk', 'Tapis', 'Bijoux']::text[], null, 1135),
  ('4f39d8e7-cc1b-4e89-a12d-57b2f8f11e7f', 'jamade', 'Jamade', 'Céramique artisanale contemporaine', 'Médina', 'Belle sélection de céramique marocaine contemporaine, pièces uniques de créateurs.', array['shopping']::text[], '', null, '+212 524 426 218', 'Médina', null, array['Céramique', 'Contemporain', 'Pièces uniques']::text[], null, 1136),
  ('011c4aea-0398-4670-a078-e371485a4d93', 'max-jan', 'Max & Jan', 'Mode féminine / Boubous africains', 'Médina', 'Créatrice belge à Marrakech. Vêtements féminins mêlant influences marocaines et africaines.', array['shopping']::text[], '', null, '+212 661 234 890', 'Médina', null, array['Mode', 'Créateur', 'Féminin']::text[], null, 1137),
  ('1f1aba80-9691-4413-a202-acd3a0443be6', 'souk-des-teinturiers', 'Souk des Teinturiers', 'Laine teintée / Artisanat coloré', 'Médina', 'L''un des souks les plus photogéniques. Laines et fils teintés naturellement. Lieu unique.', array['shopping']::text[], '', null, '–', 'Souk des Teinturiers, Médina', null, array['Coloré', 'Artisanat', 'Photographique']::text[], null, 1138),
  ('3547cff4-ce06-4e0b-abf0-fdbc3cdbcec2', 'carre-eden-centre-commercial', 'Carré Eden – Centre commercial', 'Centre commercial moderne', 'Guéliz', 'Centre commercial moderne, grandes enseignes, restauration, cinéma. Air conditionné bienvenu.', array['shopping']::text[], '', null, '+212 524 439 200', 'Avenue Mohammed VI, Guéliz', '10h–22h', array['Moderne', 'Enseignes', 'Cinéma']::text[], null, 1139),
  ('238eccb2-d3e5-439b-a2dd-af2aa82fd21d', 'marjane-marrakech', 'Marjane Marrakech', 'Hypermarché', 'Route de Casablanca', 'Grand hypermarché, alimentation, électroménager, vêtements. Drive disponible.', array['shopping']::text[], '', null, '+212 524 338 100', 'Route de Casablanca, Marrakech', null, array['Hyper', 'Alimentaire', 'Électro']::text[], null, 1140),
  ('13fc88ca-eade-49a6-a496-530db19d192a', 'riad-booking-marrakech', 'Riad Booking Marrakech', 'Agence immobilière / Location', 'Guéliz', 'Spécialiste location et vente riads et villas à Marrakech. Bilingual français-anglais.', array['pratique']::text[], '', null, '+212 661 345 678', 'Guéliz', null, array['Immobilier', 'Riad', 'Location']::text[], null, 1141),
  ('256ab184-6c52-40c3-a543-5d4f997a232f', 'nettoyage-marrakech-pro', 'Nettoyage Marrakech Pro', 'Société nettoyage professionnel', 'Toute la ville', 'Nettoyage appartements, riads, villas. Équipes fiables, produits professionnels.', array['pratique']::text[], '', null, '+212 661 200 300', 'Toute la ville', null, array['Nettoyage', 'Villas', 'Fiable']::text[], null, 1142),
  ('e1af3970-9b08-4a11-a4c2-b114bcff0c68', 'plombier-urgence-marrakech', 'Plombier Urgence Marrakech', 'Plomberie / Urgences', 'Toute la ville', 'Plombier disponible 24h/24, fuites, débouchage, installation. Intervention rapide.', array['pratique']::text[], '', null, '+212 661 456 789', 'Toute la ville', null, array['Plomberie', '24h', 'Urgence']::text[], null, 1143),
  ('d4215c59-9de6-47bc-a3de-077cad1db843', 'electricien-brahim', 'Électricien Brahim', 'Électricité / Dépannage', 'Guéliz / Médina', 'Électricien de confiance, travaux et dépannage, devis gratuit, tarifs honnêtes.', array['pratique']::text[], '', null, '+212 661 567 123', 'Guéliz / Médina', null, array['Électricité', 'Dépannage', 'Fiable']::text[], null, 1144),
  ('72ae6f92-0f57-4762-a779-7321fc3cb4a6', 'notaire-maitre-berrada', 'Notaire Maître Berrada', 'Notaire / Actes juridiques', 'Guéliz', 'Transactions immobilières, testaments, procurations. Références pour achats immobiliers étrangers.', array['pratique']::text[], '', null, '+212 524 432 500', 'Guéliz', null, array['Immobilier', 'Étranger', 'Juridique']::text[], null, 1145),
  ('2dd2e227-f539-4bea-ad0d-8d15583d958e', 'cabinet-comptable-attijari', 'Cabinet Comptable Attijari', 'Comptabilité / Fiscalité Maroc', 'Guéliz', 'Comptabilité entreprises et particuliers, fiscalité marocaine, déclarations.', array['pratique']::text[], '', null, '+212 524 433 800', 'Guéliz', null, array['Compta', 'Fiscalité', 'Entreprises']::text[], null, 1146),
  ('c1e6887c-257a-464e-aa80-daf7957a650c', 'dhl-marrakech', 'DHL Marrakech', 'Courrier international express', 'Guéliz', 'Envoi express international, suivi en temps réel, ramassage à domicile possible.', array['pratique']::text[], '', null, '+212 524 435 200', 'Guéliz', '8h30–18h – Fermé dimanche', array['DHL', 'International', 'Express']::text[], null, 1147),
  ('e91cd91a-22b2-4286-ac73-b2211e8f8ec6', 'hammam-menager-femme-de-menage', 'Hammam Ménager / Femme de ménage', 'Petites annonces / Réseau', 'Toute la ville', 'Réseau de confiance pour trouver aide-ménagère, femme de chambre, cuisinière à Marrakech.', array['pratique']::text[], '', null, '+212 661 700 800', 'Toute la ville', null, array['Personnel', 'Maison', 'Confiance']::text[], null, 1148),
  ('5d9edd27-4628-4405-a98d-61dc81c9f601', 'careem-indrive-marrakech', 'Careem / inDrive Marrakech', 'VTC / Application mobile', 'Toute la ville', 'VTCs fiables à Marrakech. Prix fixé à l''avance. Préférable aux petits taxis pour les étrangers.', array['pratique']::text[], '', null, 'Application mobile', 'Application mobile', null, array['VTC', 'App', 'Prix fixe']::text[], 'top', 1149),
  ('4e9659b0-b9d5-411e-ae18-e3143994d5f9', 'aeroport-menara-taxis-officiels', 'Aéroport Menara – Taxis officiels', 'Taxis officiels Aéroport', 'Aéroport', 'Tarif officiel fixe depuis l''aéroport: ~70 MAD en centre-ville. Ne pas accepter offres informelles.', array['pratique']::text[], '', null, '+212 524 447 905', 'Aéroport Menara Marrakech', null, array['Aéroport', 'Tarif fixe', 'Officiel']::text[], null, 1150),
  ('2d71929c-2d57-4452-a673-887098e39163', 'location-voiture-europcar', 'Location voiture – Europcar', 'Location automobile', 'Guéliz / Aéroport', 'Location voitures de qualité. Aéroport et centre-ville. Réservation en ligne possible.', array['pratique']::text[], '', 'https://europcar.com', '+212 524 431 228', 'Av. Mohammed V, Guéliz', null, array['Location', 'Europcar', 'Aéroport']::text[], null, 1151),
  ('0ff5e5df-7cc9-4f3e-a296-660384350d6f', 'supratours-gare-routiere', 'Supratours – Gare routière', 'Liaisons interurbaines', 'Guéliz (gare)', 'Liaisons Marrakech–Casablanca–Agadir–Essaouira. Confort correct, ponctualité acceptable.', array['pratique']::text[], '', null, '+212 524 435 525', 'Gare Ferroviaire, Guéliz', null, array['Interurbain', 'Casablanca', 'Essaouira']::text[], null, 1152),
  ('12f9d842-7885-4323-ab95-f833d3293c26', 'jardin-majorelle-musee-yves-saint-laurent', 'Jardin Majorelle / Musée Yves Saint Laurent', 'Jardin + Musée', 'Guéliz', 'Jardin Majorelle, Collection Berbère, Musée YSL adjacent. Incontournable. Réservation en ligne obligatoire.', array['sortir']::text[], '', null, '+212 524 301 852', 'Rue Yves Saint Laurent, Guéliz', '8h–17h30 – Ouvert ts jours', array['Musée', 'Jardin', 'YSL']::text[], 'top', 1153),
  ('69b31169-9a89-4421-a2c1-9e8996ea3797', 'palais-el-badi', 'Palais El Badi', 'Monument historique', 'Médina (Kasbah)', 'Palais du XVIe siècle, vue panoramique sur la médina. Nid de cigognes au printemps.', array['sortir']::text[], '', null, '+212 524 389 164', 'Place des Ferblantiers, Kasbah', '9h–17h', array['Histoire', 'Panorama', 'Cigognes']::text[], null, 1154),
  ('1dda008a-0704-4931-a3b3-adc4ca003ba1', 'musee-de-la-palmeraie', 'Musée de la Palmeraie', 'Musée d''art contemporain', 'Palmeraie', 'Art contemporain marocain et international, dans un cadre de palmeraie. Expositions régulières.', array['sortir']::text[], '', null, '+212 524 300 680', 'Palmeraie de Marrakech', null, array['Art contemporain', 'Palmeraie', 'Expositions']::text[], null, 1155),
  ('7e705326-468a-4fad-ad21-1fcbeadf6a6e', 'institut-francais-de-marrakech', 'Institut Français de Marrakech', 'Institut culturel français', 'Guéliz', 'Cours de français et d''arabe, médiathèque, événements culturels, expositions.', array['pratique']::text[], '', null, '+212 524 446 930', 'Route de la Targa, Guéliz', null, array['Français', 'Cours', 'Culture']::text[], null, 1156)
on conflict (slug) do nothing;


-- ===================== 0003_socle.sql =====================
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


-- ===================== 0004_communaute.sql =====================
-- =====================================================================
-- Nomad Club : Lot 1 — Communauté
-- Actualités (publications, épinglage, réactions), groupes thématiques, modération
-- (mots-clés, signalements, file de modération, messages masqués), annuaire complet avec
-- confidentialité, rappels J-1 des rendez-vous, place libérée en liste d'attente.
-- À exécuter APRÈS 0001 → 0003. Ne dépend d'aucun autre lot.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nouveaux types de notifications et nouvelles cibles du journal
--    (à la fusion des lots, ces listes doivent réunir les valeurs de chaque lot)
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'booking_confirmed', 'waitlist_spot', 'event_published', 'payment_validated', 'role_changed',
  'news_published', 'event_reminder', 'group_request', 'group_joined', 'moderation_report', 'moderation_warning'
));
alter table public.notification_prefs drop constraint if exists notification_prefs_type_check;
alter table public.notification_prefs add constraint notification_prefs_type_check check (type in (
  'booking_confirmed', 'waitlist_spot', 'event_published', 'payment_validated', 'role_changed',
  'news_published', 'event_reminder', 'group_request', 'group_joined', 'moderation_report', 'moderation_warning'
));
alter table public.audit_log drop constraint if exists audit_log_target_type_check;
alter table public.audit_log add constraint audit_log_target_type_check check (target_type in (
  'payment', 'event', 'profile', 'reminder', 'organization',
  'news', 'group', 'message', 'report', 'keyword'
));

-- Minuscules sans accents (même règle que fold() dans src/lib/modules/communaute/domain.ts).
create or replace function public.nc_fold(p text) returns text
language sql immutable set search_path = public as $$
  select translate(lower(coalesce(p, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ’', 'aaaaaaceeeeiiiinooooouuuuyy''');
$$;

-- Modératrice ou administratrice ?
create or replace function public.can_moderate() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_role(array['admin', 'moderator']);
$$;
revoke all on function public.can_moderate() from public, anon;
grant execute on function public.can_moderate() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. Actualités
-- ---------------------------------------------------------------------
create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 140),
  body text not null default '' check (length(body) <= 10000),
  -- photo du club (/img/…), adresse https ou image importée (data URL) : 1,5 Mo au plus
  image text check (image is null or length(image) <= 1500000),
  pinned boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_id uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_published_has_date check (status = 'draft' or published_at is not null)
);
create index news_posts_feed_idx on public.news_posts (status, pinned desc, published_at desc);

create table public.news_reactions (
  post_id uuid not null references public.news_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('like', 'bravo', 'merci')),
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id, kind)
);
create index news_reactions_profile_idx on public.news_reactions (profile_id);

alter table public.news_posts enable row level security;
alter table public.news_reactions enable row level security;

-- le cercle lit les publications publiées ; l'administratrice gère tout (brouillons compris)
create policy news_posts_read on public.news_posts for select to authenticated using (
  (status = 'published' and public.has_any_role(array['member', 'moderator', 'admin'])) or public.has_role('admin')
);
create policy news_posts_admin on public.news_posts for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- réactions : visibles par le cercle sur les publications visibles ; chacune ajoute / retire les siennes
create policy news_reactions_read on public.news_reactions for select to authenticated using (
  public.has_any_role(array['member', 'moderator', 'admin']) and exists (select 1 from public.news_posts p where p.id = post_id)
);
create policy news_reactions_insert on public.news_reactions for insert to authenticated with check (
  profile_id = auth.uid()
  and public.has_any_role(array['member', 'moderator', 'admin'])
  and exists (select 1 from public.news_posts p where p.id = post_id and p.status = 'published')
);
create policy news_reactions_delete on public.news_reactions for delete to authenticated using (profile_id = auth.uid());
revoke all on public.news_posts, public.news_reactions from anon;

-- Commentaires (optionnels : activés publication par publication)
alter table public.news_posts add column comments_enabled boolean not null default false;

create table public.news_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.news_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index news_comments_post_idx on public.news_comments (post_id, created_at);
alter table public.news_comments enable row level security;

-- le cercle lit les commentaires des publications publiées
create policy news_comments_read on public.news_comments for select to authenticated using (
  public.has_any_role(array['member', 'moderator', 'admin'])
  and exists (select 1 from public.news_posts p where p.id = post_id and (p.status = 'published' or public.has_role('admin')))
);
-- chacune commente en son nom, seulement si la publication est publiée et ouverte aux commentaires
create policy news_comments_insert on public.news_comments for insert to authenticated with check (
  author_id = auth.uid()
  and public.has_any_role(array['member', 'moderator', 'admin'])
  and exists (select 1 from public.news_posts p where p.id = post_id and p.status = 'published' and p.comments_enabled)
);
-- on retire son propre commentaire ; la modération retire n'importe lequel
create policy news_comments_delete on public.news_comments for delete to authenticated using (author_id = auth.uid() or public.can_moderate());
revoke all on public.news_comments from anon;

-- ---------------------------------------------------------------------
-- 2. Groupes thématiques
-- ---------------------------------------------------------------------
create table public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 2 and 80),
  description text not null default '' check (length(description) <= 400),
  icon text not null default 'users' check (icon in ('users', 'book', 'heart', 'spark', 'star', 'globe', 'home', 'chat', 'crown', 'gift', 'pin', 'cal')),
  join_policy text not null default 'open' check (join_policy in ('open', 'request')),
  -- false : groupe privé, invisible pour les non-membres (entrée sur invitation)
  listed boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.chat_group_members (
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'member' check (status in ('member', 'pending')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  primary key (group_id, profile_id)
);
create index chat_group_members_profile_idx on public.chat_group_members (profile_id);
create index chat_group_members_pending_idx on public.chat_group_members (group_id) where status = 'pending';

-- La personne connectée est-elle membre (acceptée) de ce groupe ?
create or replace function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_group_members where group_id = p_group and profile_id = auth.uid() and status = 'member');
$$;
-- …ou en attente (pour voir un groupe privé dont on a fait la demande)
create or replace function public.in_group(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_group_members where group_id = p_group and profile_id = auth.uid());
$$;
revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.in_group(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated, service_role;
grant execute on function public.in_group(uuid) to authenticated, service_role;

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;

-- groupes : le cercle voit les groupes listés et ceux dont il fait partie ; modératrices et administratrices voient et gèrent tout
create policy chat_groups_read on public.chat_groups for select to authenticated using (
  public.can_moderate()
  or (public.has_any_role(array['member', 'moderator', 'admin']) and archived_at is null and (listed or public.in_group(id)))
);
create policy chat_groups_manage on public.chat_groups for all to authenticated using (public.can_moderate()) with check (public.can_moderate());

-- membres : chacune voit ses adhésions ; les membres d'un groupe voient les autres membres ; la modération voit tout
create policy chat_group_members_read on public.chat_group_members for select to authenticated using (
  profile_id = auth.uid() or public.can_moderate() or public.is_group_member(group_id)
);
create policy chat_group_members_leave on public.chat_group_members for delete to authenticated using (profile_id = auth.uid() or public.can_moderate());
create policy chat_group_members_manage on public.chat_group_members for all to authenticated using (public.can_moderate()) with check (public.can_moderate());
revoke all on public.chat_groups, public.chat_group_members from anon;

-- Prévenir les modératrices et administratrices (demande d'adhésion, signalement).
create or replace function public.nc_notify_moderators(p_type text, p_title text, p_body text, p_except uuid, p_admin_link text, p_moderator_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (recipient_id, type, title, body, link)
  select ur.profile_id, p_type, left(p_title, 160), left(coalesce(p_body, ''), 600),
         case when bool_or(ur.role = 'admin') then p_admin_link else p_moderator_link end
    from public.user_roles ur
   where ur.role in ('admin', 'moderator') and ur.profile_id is distinct from p_except
   group by ur.profile_id;
$$;
revoke all on function public.nc_notify_moderators(text, text, text, uuid, text, text) from public, anon, authenticated;

-- Rejoindre un groupe : ouvert → membre ; sur demande → en attente (les modératrices sont prévenues).
create or replace function public.join_group(p_group uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  g public.chat_groups;
  me public.profiles;
  v_status text;
begin
  if not public.has_any_role(array['member', 'moderator', 'admin']) then raise exception 'members_only'; end if;
  select * into g from public.chat_groups where id = p_group and archived_at is null;
  if not found then raise exception 'group_not_found'; end if;
  select status into v_status from public.chat_group_members where group_id = g.id and profile_id = auth.uid();
  if found then return v_status; end if;
  if not g.listed then raise exception 'private_group'; end if;
  v_status := case when g.join_policy = 'open' then 'member' else 'pending' end;
  insert into public.chat_group_members (group_id, profile_id, status) values (g.id, auth.uid(), v_status);
  if v_status = 'pending' then
    select * into me from public.profiles where id = auth.uid();
    perform public.nc_notify_moderators('group_request', 'Demande pour « ' || g.name || ' »',
      trim(coalesce(me.first_name, '') || ' ' || coalesce(me.last_name, '')) || ' souhaite rejoindre le groupe.',
      auth.uid(), '/fondatrices/communaute/groupes', '/espace/moderation?onglet=groupes');
  end if;
  return v_status;
end $$;
revoke all on function public.join_group(uuid) from public, anon;
grant execute on function public.join_group(uuid) to authenticated;

-- Accepter ou refuser une demande (modératrices, administratrices). La membre acceptée est prévenue.
create or replace function public.decide_group_request(p_group uuid, p_profile uuid, p_approve boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  g public.chat_groups;
begin
  if not public.can_moderate() then raise exception 'moderators_only'; end if;
  select * into g from public.chat_groups where id = p_group;
  if not found then return false; end if;
  if p_approve then
    update public.chat_group_members set status = 'member', decided_by = auth.uid(), decided_at = now()
     where group_id = p_group and profile_id = p_profile and status = 'pending';
    if not found then return false; end if;
    insert into public.notifications (recipient_id, type, title, body, link)
    values (p_profile, 'group_joined', 'Bienvenue dans « ' || left(g.name, 120) || ' »', 'Ta demande est acceptée : tu peux écrire dans le groupe.', '/espace/cercle/groupes/' || g.slug);
  else
    delete from public.chat_group_members where group_id = p_group and profile_id = p_profile and status = 'pending';
    if not found then return false; end if;
  end if;
  return true;
end $$;
revoke all on function public.decide_group_request(uuid, uuid, boolean) from public, anon;
grant execute on function public.decide_group_request(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Messagerie : canal de groupe, messages masqués
-- ---------------------------------------------------------------------
alter table public.messages drop constraint if exists messages_channel_check;
alter table public.messages add constraint messages_channel_check check (
  channel = 'general' or channel ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$' or channel ~ '^group:[0-9a-f-]{36}$'
);
alter table public.messages
  add column hidden_at timestamptz,
  add column hidden_by uuid references public.profiles (id) on delete set null,
  add column hidden_reason text check (hidden_reason is null or length(hidden_reason) <= 200);
create index if not exists messages_channel_created_idx on public.messages (channel, created_at);

-- La personne connectée peut-elle lire ce canal ? (salon : le cercle ; privé : les deux personnes ; groupe : ses membres et la modération)
create or replace function public.can_read_channel(p_channel text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_any_role(array['member', 'moderator', 'admin']) then return false; end if;
  if p_channel = 'general' then return true; end if;
  if p_channel like 'dm:%' then return position(auth.uid()::text in p_channel) > 0; end if;
  if p_channel ~ '^group:[0-9a-f-]{36}$' then
    return public.is_group_member(substr(p_channel, 7)::uuid) or public.can_moderate();
  end if;
  return false;
end $$;
revoke all on function public.can_read_channel(text) from public, anon;
grant execute on function public.can_read_channel(text) to authenticated, service_role;

create policy messages_group_read on public.messages for select to authenticated using (channel like 'group:%' and public.can_read_channel(channel));
create policy messages_group_write on public.messages for insert to authenticated with check (
  channel like 'group:%'
  and author_id = auth.uid()
  and public.has_any_role(array['member', 'moderator', 'admin'])
  and public.is_group_member(substr(channel, 7)::uuid)
);

-- Texte d'origine des messages masqués : seules la modération le relit ; rendu au rétablissement.
create table public.message_originals (
  message_id uuid primary key references public.messages (id) on delete cascade,
  body text not null,
  hidden_at timestamptz not null default now()
);
alter table public.message_originals enable row level security;
create policy message_originals_read on public.message_originals for select to authenticated using (public.can_moderate());
revoke insert, update, delete on public.message_originals from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Modération : mots-clés, signalements, file de modération
-- ---------------------------------------------------------------------
create table public.moderation_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null check (length(trim(keyword)) between 2 and 60),
  -- hide : masquer le message et le signaler ; flag : seulement le signaler
  action text not null default 'flag' check (action in ('hide', 'flag')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index moderation_keywords_unique on public.moderation_keywords (public.nc_fold(trim(keyword)));
alter table public.moderation_keywords enable row level security;
create policy moderation_keywords_manage on public.moderation_keywords for all to authenticated using (public.can_moderate()) with check (public.can_moderate());
revoke all on public.moderation_keywords from anon;

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  -- null : signalement automatique (mot-clé)
  reporter_id uuid references public.profiles (id) on delete set null,
  source text not null check (source in ('member', 'keyword', 'moderator')),
  reason text not null default '' check (length(reason) <= 300),
  keyword text,
  -- copie du message au moment du signalement
  message_body text not null,
  message_author_id uuid references public.profiles (id) on delete set null,
  channel text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text check (resolution in ('hidden', 'restored', 'warned', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_resolution check ((status = 'open') = (resolution is null))
);
create index message_reports_status_idx on public.message_reports (status, created_at desc);
create index message_reports_message_idx on public.message_reports (message_id);
create unique index message_reports_one_open on public.message_reports (message_id, reporter_id) where status = 'open' and reporter_id is not null;

alter table public.message_reports enable row level security;
-- la file : modératrices et administratrices ; chaque membre retrouve ses propres signalements
create policy message_reports_read on public.message_reports for select to authenticated using (public.can_moderate() or reporter_id = auth.uid());
create policy message_reports_update on public.message_reports for update to authenticated using (public.can_moderate()) with check (public.can_moderate());
revoke insert, delete on public.message_reports from anon, authenticated;
revoke all on public.message_reports from anon;

-- Masquer un message (usage interne : déclencheur et fonctions de modération).
create or replace function public.nc_hide_message(p_message uuid, p_actor uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  m public.messages;
begin
  select * into m from public.messages where id = p_message for update;
  if not found then return false; end if;
  if m.hidden_at is not null then return true; end if;
  insert into public.message_originals (message_id, body) values (m.id, m.body)
  on conflict (message_id) do update set body = excluded.body, hidden_at = now();
  update public.messages set body = '[masqué]', hidden_at = now(), hidden_by = p_actor, hidden_reason = left(p_reason, 200) where id = m.id;
  return true;
end $$;
revoke all on function public.nc_hide_message(uuid, uuid, text) from public, anon, authenticated;

-- Nouveau signalement d'une membre ou d'un mot-clé : la modération est prévenue.
create or replace function public.message_reports_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'moderator' then return null; end if;
  perform public.nc_notify_moderators('moderation_report',
    case when new.source = 'member' then 'Nouveau signalement' else 'Mot-clé repéré : ' || coalesce(new.keyword, '') end,
    '« ' || left(new.message_body, 120) || ' »', new.reporter_id,
    '/fondatrices/communaute/moderation', '/espace/moderation');
  return null;
end $$;
create trigger message_reports_notify after insert on public.message_reports for each row execute function public.message_reports_notify();

-- Modération automatique : chaque nouveau message (salon, privé, groupe) est comparé aux mots-clés.
create or replace function public.messages_keyword_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_all text;
  v_hide text;
  v_first text;
begin
  select string_agg(trim(keyword), ', ' order by (action = 'hide') desc, created_at),
         (array_agg(trim(keyword) order by created_at) filter (where action = 'hide'))[1],
         (array_agg(trim(keyword) order by (action = 'hide') desc, created_at))[1]
    into v_all, v_hide, v_first
    from public.moderation_keywords
   where position(public.nc_fold(trim(keyword)) in public.nc_fold(new.body)) > 0;
  if v_all is null then return null; end if;
  if v_hide is not null then
    perform public.nc_hide_message(new.id, null, 'Mot-clé « ' || v_hide || ' »');
  end if;
  insert into public.message_reports (message_id, reporter_id, source, reason, keyword, message_body, message_author_id, channel)
  values (new.id, null, 'keyword',
          case when v_hide is not null then 'Masqué automatiquement : « ' || v_hide || ' »' else 'Mot-clé à vérifier : « ' || v_first || ' »' end,
          v_all, new.body, new.author_id, new.channel);
  return null;
end $$;
create trigger messages_keywords after insert on public.messages for each row execute function public.messages_keyword_check();

-- Signaler un message qu'on peut lire (pas le sien). Renvoie l'identifiant du signalement.
create or replace function public.report_message(p_message uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  m public.messages;
  v_id uuid;
begin
  if not public.has_any_role(array['member', 'moderator', 'admin']) then raise exception 'members_only'; end if;
  select * into m from public.messages where id = p_message;
  if not found or not public.can_read_channel(m.channel) then raise exception 'message_not_found'; end if;
  if m.author_id = auth.uid() then raise exception 'own_message'; end if;
  select id into v_id from public.message_reports where message_id = m.id and reporter_id = auth.uid() and status = 'open';
  if found then return v_id; end if;
  insert into public.message_reports (message_id, reporter_id, source, reason, message_body, message_author_id, channel)
  values (m.id, auth.uid(), 'member', left(coalesce(nullif(trim(p_reason), ''), 'Sans motif'), 300),
          coalesce((select body from public.message_originals where message_id = m.id), m.body), m.author_id, m.channel)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.report_message(uuid, text) from public, anon;
grant execute on function public.report_message(uuid, text) to authenticated;

-- Masquer ou rétablir un message (modératrices, administratrices).
create or replace function public.moderate_message(p_message uuid, p_action text, p_reason text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  m public.messages;
  v_body text;
  v_ok boolean;
begin
  if not public.can_moderate() then raise exception 'moderators_only'; end if;
  if p_action = 'hide' then
    v_ok := public.nc_hide_message(p_message, auth.uid(), coalesce(nullif(trim(p_reason), ''), 'Masqué par la modération'));
    if v_ok and not exists (select 1 from public.message_reports where message_id = p_message) then
      select * into m from public.messages where id = p_message;
      insert into public.message_reports (message_id, reporter_id, source, reason, message_body, message_author_id, channel, status, resolution, resolved_by, resolved_at)
      values (m.id, auth.uid(), 'moderator', left(coalesce(nullif(trim(p_reason), ''), 'Masqué par la modération'), 300),
              coalesce((select body from public.message_originals where message_id = m.id), m.body), m.author_id, m.channel,
              'resolved', 'hidden', auth.uid(), now());
    end if;
    return v_ok;
  elsif p_action = 'restore' then
    select body into v_body from public.message_originals where message_id = p_message;
    update public.messages set body = coalesce(v_body, body), hidden_at = null, hidden_by = null, hidden_reason = null
     where id = p_message and hidden_at is not null;
    v_ok := found;
    delete from public.message_originals where message_id = p_message;
    return v_ok;
  end if;
  raise exception 'unknown_action';
end $$;
revoke all on function public.moderate_message(uuid, text, text) from public, anon;
grant execute on function public.moderate_message(uuid, text, text) to authenticated;

-- Clore un signalement (masqué, rétabli, averti, sans suite). « Avertir » prévient l'autrice.
create or replace function public.resolve_report(p_report uuid, p_resolution text) returns public.message_reports
language plpgsql security definer set search_path = public as $$
declare
  r public.message_reports;
begin
  if not public.can_moderate() then raise exception 'moderators_only'; end if;
  if p_resolution not in ('hidden', 'restored', 'warned', 'dismissed') then raise exception 'unknown_resolution'; end if;
  update public.message_reports set status = 'resolved', resolution = p_resolution, resolved_by = auth.uid(), resolved_at = now()
   where id = p_report
  returning * into r;
  if not found then return null; end if;
  if p_resolution = 'warned' and r.message_author_id is not null then
    insert into public.notifications (recipient_id, type, title, body, link)
    values (r.message_author_id, 'moderation_warning', 'Un mot de la modération',
            'Un de tes messages ne respecte pas la charte du club : « ' || left(r.message_body, 120) || ' ». Merci d’y veiller.', '/espace/cercle');
  end if;
  return r;
end $$;
revoke all on function public.resolve_report(uuid, text) from public, anon;
grant execute on function public.resolve_report(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Annuaire : fiche complète et confidentialité
-- ---------------------------------------------------------------------
create table public.directory_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  company text check (length(company) <= 120),
  sector text check (length(sector) <= 80),
  skills text[] not null default '{}' check (cardinality(skills) <= 12),
  instagram text check (length(instagram) <= 200),
  linkedin text check (length(linkedin) <= 200),
  website text check (length(website) <= 200),
  looking_for text check (length(looking_for) <= 500),
  offering text check (length(offering) <= 500),
  -- all : fiche complète ; basic : nom et métier seulement ; hidden : absente de l'annuaire
  visibility text not null default 'all' check (visibility in ('all', 'basic', 'hidden')),
  show_whatsapp boolean not null default false,
  show_email boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.directory_profiles enable row level security;
-- la table brute : chacune la sienne, l'administratrice toutes ; les autres passent par directory_list()
create policy directory_profiles_own on public.directory_profiles for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy directory_profiles_admin on public.directory_profiles for all using (public.has_role('admin')) with check (public.has_role('admin'));
revoke all on public.directory_profiles from anon;

-- Annuaire vu par la personne connectée : confidentialité appliquée côté base
-- (même règle que toDirectoryEntry() dans src/lib/modules/communaute/domain.ts).
create or replace function public.directory_list()
returns table (
  id uuid, first_name text, last_name text, job text, limited boolean, avatar_url text, company text, sector text,
  country text, marrakech_since text, bio text, skills text[], instagram text, linkedin text, website text,
  looking_for text, offering text, whatsapp text, email text, is_founder boolean, plan text
)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.last_name, p.job, v.limited,
         case when v.limited then null else p.avatar_url end,
         case when v.limited then null else d.company end,
         case when v.limited then null else d.sector end,
         case when v.limited then null else p.country end,
         case when v.limited then null else p.marrakech_since end,
         case when v.limited then null else p.bio end,
         case when v.limited then '{}'::text[] else coalesce(d.skills, '{}'::text[]) end,
         case when v.limited then null else d.instagram end,
         case when v.limited then null else d.linkedin end,
         case when v.limited then null else d.website end,
         case when v.limited then null else d.looking_for end,
         case when v.limited then null else d.offering end,
         case when not v.limited and (v.admin or coalesce(d.show_whatsapp, false)) then p.whatsapp end,
         case when not v.limited and (v.admin or coalesce(d.show_email, false)) then p.email end,
         public.user_has_any_role(p.id, array['admin']),
         p.plan
    from public.profiles p
    left join public.directory_profiles d on d.profile_id = p.id
   cross join lateral (
     select public.has_role('admin') as admin,
            (coalesce(d.visibility, 'all') = 'basic' and not public.has_role('admin')) as limited
   ) v
   where public.has_any_role(array['member', 'moderator', 'admin'])
     and public.user_has_any_role(p.id, array['member', 'moderator', 'admin'])
     and p.id <> auth.uid()
     and (coalesce(d.visibility, 'all') <> 'hidden' or v.admin)
   order by p.first_name, p.last_name;
$$;
revoke all on function public.directory_list() from public, anon;
grant execute on function public.directory_list() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Rappels J-1 des rendez-vous (une seule fois par inscrite)
-- ---------------------------------------------------------------------
create table public.event_reminders (
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
alter table public.event_reminders enable row level security;
create policy event_reminders_own on public.event_reminders for select to authenticated using (profile_id = auth.uid());
create policy event_reminders_admin on public.event_reminders for all using (public.has_role('admin')) with check (public.has_role('admin'));
revoke all on public.event_reminders from anon;

-- ---------------------------------------------------------------------
-- 7. Liste d'attente : quand une place se libère, la personne en attente peut la prendre
--    (book_event de 0001 répondait « déjà inscrite » et la bloquait sur la liste d'attente).
-- ---------------------------------------------------------------------
create or replace function public.book_event(
  p_event uuid,
  p_guest_first_name text default null,
  p_guest_whatsapp text default null,
  p_mode text default 'transfer',
  p_waitlist boolean default false
) returns json
language plpgsql security definer set search_path = public as $$
declare
  ev public.events;
  me public.profiles;
  v_plan text := 'free';
  v_price int;
  v_taken int;
  v_wait int;
  v_existing public.bookings;
  v_booking public.bookings;
  v_status text;
  v_method text;
begin
  select * into ev from public.events where id = p_event for update;
  if not found or ev.status <> 'published' or ev.starts_at < now() - interval '1 day' then
    raise exception 'closed';
  end if;
  if auth.uid() is not null then
    select * into me from public.profiles where id = auth.uid();
    v_plan := coalesce(me.plan, 'free');
    if me.plan_ends_at is not null and me.plan_ends_at < current_date then v_plan := 'free'; end if;
  elsif coalesce(length(trim(p_guest_first_name)), 0) < 2 or length(regexp_replace(coalesce(p_guest_whatsapp, ''), '\D', '', 'g')) < 8 then
    raise exception 'guest';
  end if;

  -- déjà inscrite ?
  select * into v_existing from public.bookings b
   where b.event_id = ev.id and b.status <> 'cancelled'
     and ((me.id is not null and b.profile_id = me.id)
       or (me.id is null and regexp_replace(coalesce(b.guest_whatsapp, ''), '\D', '', 'g') = regexp_replace(p_guest_whatsapp, '\D', '', 'g')))
   limit 1;
  if found then
    -- en liste d'attente et une place est libre : la demande d'attente laisse place à une vraie réservation
    if v_existing.status = 'waitlist' and not p_waitlist then
      select count(*) filter (where status in ('pending', 'paid', 'offered')) into v_taken from public.bookings where event_id = ev.id;
      if v_taken < ev.capacity then
        update public.bookings set status = 'cancelled' where id = v_existing.id;
        v_existing := null;
      end if;
    end if;
    if v_existing.id is not null then
      return json_build_object('status', 'already', 'booking_id', v_existing.id, 'ticket_code', v_existing.ticket_code, 'booking_status', v_existing.status);
    end if;
  end if;

  if ev.premium_free then
    v_price := case when v_plan = 'premium' then 0 else null end;
  else
    v_price := case when v_plan = 'free' then ev.price_public else ev.price_member end;
  end if;
  if v_price is null and not p_waitlist then raise exception 'premium_only'; end if;

  select count(*) filter (where status in ('pending', 'paid', 'offered')), count(*) filter (where status = 'waitlist')
    into v_taken, v_wait from public.bookings where event_id = ev.id;

  if v_taken >= ev.capacity then
    if not p_waitlist then return json_build_object('status', 'full'); end if;
    insert into public.bookings (event_id, profile_id, guest_first_name, guest_whatsapp, status, amount, method, ticket_code)
    values (ev.id, me.id, case when me.id is null then trim(p_guest_first_name) end, case when me.id is null then p_guest_whatsapp end,
            'waitlist', 0, 'free', public.new_ticket_code(ev.starts_at))
    returning * into v_booking;
    return json_build_object('status', 'waitlist', 'booking_id', v_booking.id, 'ticket_code', v_booking.ticket_code, 'position', v_wait + 1);
  end if;

  v_price := coalesce(v_price, 0);
  if v_price = 0 then
    v_status := case when ev.premium_free then 'offered' else 'paid' end;
    v_method := 'free';
  else
    v_status := 'pending';
    v_method := case when p_mode = 'stripe' then 'card' else 'transfer' end;
  end if;

  insert into public.bookings (event_id, profile_id, guest_first_name, guest_whatsapp, status, amount, method, ticket_code)
  values (ev.id, me.id, case when me.id is null then trim(p_guest_first_name) end, case when me.id is null then p_guest_whatsapp end,
          v_status, v_price, v_method, public.new_ticket_code(ev.starts_at))
  returning * into v_booking;

  if v_method = 'transfer' then
    insert into public.payments (profile_id, payer_name, kind, booking_id, amount, method, status)
    values (me.id, coalesce(nullif(trim(coalesce(me.first_name, '') || ' ' || coalesce(me.last_name, '')), ''), trim(p_guest_first_name)),
            'booking', v_booking.id, v_price, 'transfer', 'declared');
  end if;

  return json_build_object('status', 'booked', 'booking_id', v_booking.id, 'ticket_code', v_booking.ticket_code);
end $$;


-- ===================== 0005_partenaires.sql =====================
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


-- ===================== 0006_engagement.sql =====================
-- =====================================================================
-- Nomad Club : engagement (Lot 4)
-- Dashboard à widgets (préférences), ressources digitales (boutique, achats, fichiers),
-- parrainage (codes, filleules, récompenses), Espace Business (deals entre membres, points).
-- Ne dépend que de 0001 à 0003 : applicable dans n'importe quel ordre après 0003.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Types de notifications et cibles du journal : on AJOUTE les valeurs du lot
--    à celles déjà autorisées (sans retirer celles des autres lots, quel que soit l'ordre).
-- ---------------------------------------------------------------------
create or replace function public.nc_extend_check(p_table text, p_column text, p_values text[]) returns void
language plpgsql as $$
declare
  c record;
  existing text[] := '{}';
  merged text[];
  cname text := p_table || '_' || p_column || '_check';
begin
  for c in
    select con.conname, pg_get_constraintdef(con.oid) as def
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname = p_table and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ~ ('\m' || p_column || '\M') and pg_get_constraintdef(con.oid) ~ 'ANY|IN \('
  loop
    existing := existing || array(select m[1] from regexp_matches(c.def, '''([^'']+)''', 'g') as m);
    execute format('alter table public.%I drop constraint %I', p_table, c.conname);
  end loop;
  select array_agg(distinct v order by v) into merged from unnest(existing || p_values) as v;
  execute format('alter table public.%I add constraint %I check (%I = any (%L::text[]))', p_table, cname, p_column, merged);
end $$;

select public.nc_extend_check('notifications', 'type', array['purchase_completed', 'referral_signup', 'referral_rewarded', 'deal_declared', 'deal_answered']);
select public.nc_extend_check('notification_prefs', 'type', array['purchase_completed', 'referral_signup', 'referral_rewarded', 'deal_declared', 'deal_answered']);
select public.nc_extend_check('audit_log', 'target_type', array['product', 'referral', 'deal', 'settings']);

-- ---------------------------------------------------------------------
-- 1. Réglages du lot (une seule ligne) et préférences de chaque membre
-- ---------------------------------------------------------------------
create table public.engagement_settings (
  id smallint primary key default 1 check (id = 1),
  -- barème de l'Espace Business : points de base par deal confirmé + bonus selon le montant (plafonné)
  deal_points_base integer not null default 10 check (deal_points_base between 0 and 1000),
  deal_points_per_thousand integer not null default 2 check (deal_points_per_thousand between 0 and 1000),
  deal_points_bonus_cap integer not null default 40 check (deal_points_bonus_cap between 0 and 10000),
  -- paiement simulé de la boutique (remplacé par le vrai paiement au Lot 2). Coupé par défaut en production.
  simulated_payments boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.engagement_settings (id) values (1) on conflict do nothing;

create table public.engagement_prefs (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  -- ordre et activation des widgets : [{"id": "weather", "enabled": true}, …]
  widgets jsonb not null default '[]'::jsonb check (jsonb_typeof(widgets) = 'array'),
  leaderboard_opt_out boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Ressources digitales
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(title) between 2 and 140),
  subtitle text check (subtitle is null or length(subtitle) <= 200),
  description text not null default '' check (length(description) <= 6000),
  category text not null default 'guide' check (category in ('guide', 'modele', 'formation', 'carnet')),
  cover_image text,
  price numeric(10, 2) not null check (price >= 0),
  price_member numeric(10, 2) not null check (price_member >= 0),
  preview_text text check (preview_text is null or length(preview_text) <= 3000),
  pages integer check (pages is null or pages > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint member_price_lower check (price_member <= price)
);

create table public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null check (length(label) between 1 and 140),
  file_name text not null check (file_name ~ '^[A-Za-z0-9._-]+$'),
  -- chemin dans le bucket privé « ressources » (null : fichier d'exemple généré)
  storage_path text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  is_preview boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_files_product_idx on public.product_files (product_id, sort_order);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  method text not null check (method in ('simulated', 'card', 'transfer', 'free')),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  payment_ref text,
  created_at timestamptz not null default now()
);
create unique index purchases_one_paid on public.purchases (product_id, profile_id) where status = 'paid';
create index purchases_profile_idx on public.purchases (profile_id);

-- ---------------------------------------------------------------------
-- 3. Parrainage
-- ---------------------------------------------------------------------
create table public.referral_codes (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{2,12}-[A-Z0-9]{3,6}$'),
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null unique references public.profiles (id) on delete cascade,
  -- prénom + initiale, figé à l'inscription (la marraine ne voit pas la fiche d'un compte gratuit)
  referred_name text not null check (length(referred_name) between 1 and 80),
  code text not null,
  status text not null default 'signed_up' check (status in ('signed_up', 'member', 'cancelled')),
  created_at timestamptz not null default now(),
  converted_at timestamptz,
  constraint not_self check (referrer_id <> referred_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id);

create table public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('free_month', 'invitation', 'points', 'other')),
  label text not null check (length(label) between 2 and 120),
  description text check (description is null or length(description) <= 400),
  points integer not null default 0 check (points between 0 and 10000),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.referral_reward_grants (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals (id) on delete cascade,
  reward_id uuid references public.referral_rewards (id) on delete set null,
  beneficiary_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('free_month', 'invitation', 'points', 'other')),
  label text not null,
  points integer not null default 0,
  status text not null default 'granted' check (status in ('granted', 'delivered')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  delivered_by uuid references public.profiles (id) on delete set null,
  unique (referral_id, reward_id)
);
create index referral_reward_grants_beneficiary_idx on public.referral_reward_grants (beneficiary_id);

-- ---------------------------------------------------------------------
-- 4. Espace Business : deals entre membres et points
--    Le club ne prélève aucune commission et n'est pas partie aux deals.
-- ---------------------------------------------------------------------
create table public.business_deals (
  id uuid primary key default gen_random_uuid(),
  declared_by uuid not null references public.profiles (id) on delete cascade,
  partner_id uuid not null references public.profiles (id) on delete cascade,
  nature text not null check (length(nature) between 3 and 200),
  category text not null default 'prestation' check (category in ('prestation', 'vente', 'partenariat', 'recommandation', 'autre')),
  amount numeric(12, 2) check (amount is null or amount >= 0),
  deal_date date not null,
  note text check (note is null or length(note) <= 600),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'refused')),
  points_each integer not null default 0 check (points_each >= 0),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint two_people check (declared_by <> partner_id)
);
create index business_deals_declared_idx on public.business_deals (declared_by);
create index business_deals_partner_idx on public.business_deals (partner_id);

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  points integer not null,
  source text not null check (source in ('deal', 'referral', 'adjust')),
  ref_id uuid,
  label text not null check (length(label) between 1 and 200),
  created_at timestamptz not null default now()
);
create index points_ledger_profile_idx on public.points_ledger (profile_id);

-- ---------------------------------------------------------------------
-- 5. Fonctions métier
-- ---------------------------------------------------------------------
create or replace function public.in_circle() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_role(array['member', 'moderator', 'admin']);
$$;

-- Points d'un deal confirmé selon le barème (montant facultatif).
create or replace function public.deal_points(p_amount numeric) returns integer
language sql stable security definer set search_path = public as $$
  select s.deal_points_base + least(s.deal_points_bonus_cap, floor(coalesce(p_amount, 0) / 1000)::int * s.deal_points_per_thousand)
    from public.engagement_settings s where s.id = 1;
$$;

-- Achat avec paiement simulé (en attendant le vrai paiement du Lot 2). Renvoie l'achat (existant ou nouveau).
create or replace function public.purchase_product_simulated(p_product uuid) returns public.purchases
language plpgsql security definer set search_path = public as $$
declare
  prod public.products;
  done public.purchases;
begin
  if auth.uid() is null or not public.in_circle() then raise exception 'not_allowed'; end if;
  if not (select simulated_payments from public.engagement_settings where id = 1) then raise exception 'payment_unavailable'; end if;
  select * into prod from public.products where id = p_product and status = 'published';
  if not found then raise exception 'product_unavailable'; end if;
  select * into done from public.purchases where product_id = p_product and profile_id = auth.uid() and status = 'paid';
  if found then return done; end if;
  insert into public.purchases (product_id, profile_id, amount, method, payment_ref)
  values (p_product, auth.uid(), prod.price_member, case when prod.price_member = 0 then 'free' else 'simulated' end, 'SIM-' || upper(substr(md5(random()::text), 1, 10)))
  returning * into done;
  return done;
end $$;

-- Code de parrainage de la personne connectée (créé à la première demande).
create or replace function public.my_referral_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  c text;
  base text;
begin
  if auth.uid() is null or not public.in_circle() then raise exception 'not_allowed'; end if;
  select code into c from public.referral_codes where profile_id = auth.uid();
  if found then return c; end if;
  select left(regexp_replace(upper(translate(coalesce(first_name, 'NOMAD'), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ', 'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY')), '[^A-Z0-9]', '', 'g'), 10)
    into base from public.profiles where id = auth.uid();
  if base is null or length(base) < 2 then base := 'NOMAD'; end if;
  loop
    c := base || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    exit when not exists (select 1 from public.referral_codes where code = c);
  end loop;
  insert into public.referral_codes (profile_id, code) values (auth.uid(), c);
  return c;
end $$;

-- La personne connectée s'inscrit avec un code de parrainage (une seule fois, avant d'être membre).
create or replace function public.claim_referral(p_code text) returns public.referrals
language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  r public.referrals;
  nm text;
begin
  if auth.uid() is null then return null; end if;
  select profile_id into owner from public.referral_codes where code = upper(trim(p_code));
  if owner is null or owner = auth.uid() then return null; end if;
  if exists (select 1 from public.referrals where referred_id = auth.uid()) then return null; end if;
  if public.has_any_role(array['member', 'moderator', 'admin']) then return null; end if;
  select trim(first_name || ' ' || coalesce(left(nullif(last_name, ''), 1) || '.', '')) into nm from public.profiles where id = auth.uid();
  insert into public.referrals (referrer_id, referred_id, referred_name, code)
  values (owner, auth.uid(), coalesce(nullif(nm, ''), 'Nouvelle inscrite'), upper(trim(p_code)))
  returning * into r;
  insert into public.notifications (recipient_id, type, title, body, link)
  values (owner, 'referral_signup', 'Une filleule s’est inscrite', r.referred_name || ' s’est inscrite avec ton code. Ta récompense arrive dès qu’elle devient membre.', '/espace/parrainage');
  return r;
end $$;

-- Quand une filleule devient membre : parrainage converti, récompenses actives attribuées, points crédités.
create or replace function public.referral_on_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r public.referrals;
  w public.referral_rewards;
  labels text := '';
begin
  if new.role <> 'member' then return new; end if;
  update public.referrals set status = 'member', converted_at = now()
   where referred_id = new.profile_id and status = 'signed_up'
  returning * into r;
  if not found then return new; end if;
  for w in select * from public.referral_rewards where active order by sort_order, created_at loop
    insert into public.referral_reward_grants (referral_id, reward_id, beneficiary_id, kind, label, points, status, delivered_at)
    values (r.id, w.id, r.referrer_id, w.kind, w.label, w.points, case when w.kind = 'points' then 'delivered' else 'granted' end, case when w.kind = 'points' then now() end)
    on conflict do nothing;
    if w.points > 0 then
      insert into public.points_ledger (profile_id, points, source, ref_id, label)
      values (r.referrer_id, w.points, 'referral', r.id, 'Parrainage · ' || r.referred_name);
    end if;
    labels := labels || case when labels = '' then '' else ', ' end || w.label;
  end loop;
  insert into public.notifications (recipient_id, type, title, body, link)
  values (r.referrer_id, 'referral_rewarded', 'Ta filleule est devenue membre', r.referred_name || ' a rejoint le club.' || case when labels <> '' then ' Ta récompense : ' || labels || '.' else '' end, '/espace/parrainage');
  return new;
end $$;
create trigger referral_on_member after insert on public.user_roles for each row execute function public.referral_on_member();

-- L'autre membre répond à un deal déclaré. Une fois confirmé, les deux reçoivent les points du barème.
create or replace function public.respond_deal(p_deal uuid, p_accept boolean) returns public.business_deals
language plpgsql security definer set search_path = public as $$
declare
  d public.business_deals;
  pts integer;
begin
  select * into d from public.business_deals where id = p_deal for update;
  if not found or d.partner_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if d.status <> 'pending' then return d; end if;
  if p_accept then
    pts := public.deal_points(d.amount);
    update public.business_deals set status = 'confirmed', responded_at = now(), points_each = pts where id = p_deal returning * into d;
    insert into public.points_ledger (profile_id, points, source, ref_id, label)
    values (d.declared_by, pts, 'deal', d.id, 'Deal confirmé · ' || d.nature), (d.partner_id, pts, 'deal', d.id, 'Deal confirmé · ' || d.nature);
  else
    update public.business_deals set status = 'refused', responded_at = now() where id = p_deal returning * into d;
  end if;
  return d;
end $$;

-- Classement des points (sans les membres qui s'en sont retirées). Réservé au cercle.
create or replace function public.business_leaderboard(p_limit integer default 20)
returns table (profile_id uuid, first_name text, last_name text, points bigint, deals bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.last_name, sum(l.points)::bigint,
         (select count(*) from public.business_deals d where d.status = 'confirmed' and (d.declared_by = p.id or d.partner_id = p.id))
    from public.points_ledger l
    join public.profiles p on p.id = l.profile_id
   where public.in_circle()
     and not exists (select 1 from public.engagement_prefs e where e.profile_id = p.id and e.leaderboard_opt_out)
   group by p.id, p.first_name, p.last_name
  having sum(l.points) > 0
   order by sum(l.points) desc, p.first_name
   limit least(greatest(p_limit, 1), 100);
$$;

-- Membres du cercle que l'on peut choisir comme partenaire d'un deal ?
create or replace function public.deal_partner_ok(p_partner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.user_has_any_role(p_partner, array['member', 'moderator', 'admin']);
$$;

revoke all on function public.nc_extend_check(text, text, text[]) from public, anon, authenticated;
revoke all on function public.in_circle() from public, anon;
revoke all on function public.deal_points(numeric) from public, anon;
revoke all on function public.purchase_product_simulated(uuid) from public, anon;
revoke all on function public.my_referral_code() from public, anon;
revoke all on function public.claim_referral(text) from public, anon;
revoke all on function public.respond_deal(uuid, boolean) from public, anon;
revoke all on function public.business_leaderboard(integer) from public, anon;
revoke all on function public.deal_partner_ok(uuid) from public, anon;
grant execute on function public.in_circle(), public.deal_points(numeric), public.purchase_product_simulated(uuid), public.my_referral_code(),
  public.claim_referral(text), public.respond_deal(uuid, boolean), public.business_leaderboard(integer), public.deal_partner_ok(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Sécurité ligne par ligne
-- ---------------------------------------------------------------------
alter table public.engagement_settings enable row level security;
alter table public.engagement_prefs enable row level security;
alter table public.products enable row level security;
alter table public.product_files enable row level security;
alter table public.purchases enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.referral_reward_grants enable row level security;
alter table public.business_deals enable row level security;
alter table public.points_ledger enable row level security;

-- réglages : lus par les personnes connectées, modifiés par l'admin
create policy engagement_settings_read on public.engagement_settings for select to authenticated using (true);
create policy engagement_settings_admin on public.engagement_settings for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- préférences : chacune les siennes
create policy engagement_prefs_own on public.engagement_prefs for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy engagement_prefs_admin_read on public.engagement_prefs for select using (public.has_role('admin'));

-- boutique : le cercle voit les produits publiés ; l'admin gère tout
create policy products_circle_read on public.products for select to authenticated using (status = 'published' and public.in_circle());
create policy products_admin on public.products for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- fichiers : aperçus pour le cercle, le reste seulement après achat
create policy product_files_read on public.product_files for select to authenticated using (
  exists (select 1 from public.purchases pu where pu.product_id = product_files.product_id and pu.profile_id = auth.uid() and pu.status = 'paid')
  or (is_preview and public.in_circle() and exists (select 1 from public.products p where p.id = product_files.product_id and p.status = 'published'))
);
create policy product_files_admin on public.product_files for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- achats : chacune les siens (création par purchase_product_simulated ou, plus tard, le webhook de paiement)
create policy purchases_own_read on public.purchases for select using (profile_id = auth.uid());
create policy purchases_admin on public.purchases for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- parrainage
create policy referral_codes_own_read on public.referral_codes for select using (profile_id = auth.uid());
create policy referral_codes_admin on public.referral_codes for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy referrals_own_read on public.referrals for select using (referrer_id = auth.uid() or referred_id = auth.uid());
create policy referrals_admin on public.referrals for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy referral_rewards_read on public.referral_rewards for select to authenticated using (active or public.has_role('admin'));
create policy referral_rewards_admin on public.referral_rewards for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy referral_grants_own_read on public.referral_reward_grants for select using (beneficiary_id = auth.uid());
create policy referral_grants_admin on public.referral_reward_grants for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- deals : chacune voit ceux où elle est partie ; déclaration en son nom, en attente, avec une membre du cercle
create policy business_deals_own_read on public.business_deals for select using (declared_by = auth.uid() or partner_id = auth.uid());
create policy business_deals_declare on public.business_deals for insert to authenticated with check (
  declared_by = auth.uid() and status = 'pending' and points_each = 0 and responded_at is null
  and public.in_circle() and public.deal_partner_ok(partner_id)
);
create policy business_deals_withdraw on public.business_deals for delete using (declared_by = auth.uid() and status = 'pending');
create policy business_deals_admin on public.business_deals for all using (public.has_role('admin')) with check (public.has_role('admin'));
-- la réponse passe par respond_deal() : aucune politique de modification pour les membres

create policy points_ledger_own_read on public.points_ledger for select using (profile_id = auth.uid());
create policy points_ledger_admin on public.points_ledger for all using (public.has_role('admin')) with check (public.has_role('admin'));

revoke all on public.engagement_settings, public.engagement_prefs, public.products, public.product_files, public.purchases, public.referral_codes,
  public.referrals, public.referral_rewards, public.referral_reward_grants, public.business_deals, public.points_ledger from anon;

-- ---------------------------------------------------------------------
-- 7. Stockage des fichiers (Supabase Storage, bucket privé « ressources ») : URL signées à durée courte.
--    Ignoré si le schéma storage n'existe pas (banc de test local).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('ressources', 'ressources', false) on conflict (id) do nothing;
    execute $p$create policy ressources_read on storage.objects for select to authenticated using (
      bucket_id = 'ressources' and (
        public.has_role('admin')
        or exists (
          select 1 from public.product_files f
          join public.products p on p.id = f.product_id
          where f.storage_path = storage.objects.name
            and (exists (select 1 from public.purchases pu where pu.product_id = f.product_id and pu.profile_id = auth.uid() and pu.status = 'paid')
                 or (f.is_preview and p.status = 'published' and public.in_circle()))
        )
      )
    )$p$;
    execute $p$create policy ressources_admin_write on storage.objects for all to authenticated
      using (bucket_id = 'ressources' and public.has_role('admin')) with check (bucket_id = 'ressources' and public.has_role('admin'))$p$;
  end if;
end $$;


-- ===================== 0007_crm.sql =====================
-- =====================================================================
-- Nomad Club : CRM et pilotage (Lot 5)
-- Contacts uniques (avec ou sans compte), pipeline prospects à étapes configurables,
-- activités (historique d'échanges), tâches et relances, segments enregistrés.
-- Tout est réservé aux administratrices (RLS : has_role('admin')) : une membre, une partenaire
-- ou une pro n'accède à aucune donnée du CRM.
-- Ne dépend que de 0001 → 0003 : applicable dans n'importe quel ordre après 0003.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Contacts
-- ---------------------------------------------------------------------
create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'person' check (kind in ('person', 'organization')),
  -- lien optionnel vers le compte de l'appli (une seule fiche par compte)
  profile_id uuid unique references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  first_name text not null default '',
  last_name text not null default '',
  -- société, établissement, média…
  company text,
  job text,
  email text,
  phone text,
  instagram text,
  city text,
  source text not null default 'autre'
    check (source in ('instagram', 'bouche_a_oreille', 'evenement', 'site', 'parrainage', 'partenaire', 'presse', 'linkedin', 'import', 'appli', 'autre')),
  status text not null default 'prospect'
    check (status in ('prospect', 'adherente', 'ancienne', 'partenaire', 'pro', 'presse', 'equipe', 'autre')),
  tags text[] not null default '{}',
  notes text not null default '' check (length(notes) <= 8000),
  marketing_consent boolean not null default false,
  consent_at timestamptz,
  -- responsable (Julia ou Nora)
  owner_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- (le nom est exigé par l'application ; pas de contrainte ici pour ne jamais bloquer la suppression
  -- d'un compte, qui ne fait que détacher la fiche)
  updated_at timestamptz not null default now()
);
create index crm_contacts_owner_idx on public.crm_contacts (owner_id);
create index crm_contacts_status_idx on public.crm_contacts (status);
create index crm_contacts_email_idx on public.crm_contacts (lower(email));
create index crm_contacts_tags_idx on public.crm_contacts using gin (tags);

-- ---------------------------------------------------------------------
-- 2. Pipeline : étapes configurables et opportunités
-- ---------------------------------------------------------------------
create table public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(label) between 1 and 60),
  position int not null default 0,
  -- open : en cours ; won : adhérente ; lost : perdu
  outcome text not null default 'open' check (outcome in ('open', 'won', 'lost')),
  created_at timestamptz not null default now()
);

create table public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts (id) on delete cascade,
  stage_id uuid not null references public.crm_stages (id) on delete restrict,
  title text not null check (length(title) between 1 and 160),
  -- valeur estimée (même devise que les paiements)
  value numeric(10, 2) not null default 0 check (value >= 0),
  lost_reason text check (lost_reason is null or length(lost_reason) <= 300),
  owner_id uuid references public.profiles (id) on delete set null,
  position int not null default 0,
  expected_close date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_deals_contact_idx on public.crm_deals (contact_id);
create index crm_deals_stage_idx on public.crm_deals (stage_id, position);

-- ---------------------------------------------------------------------
-- 3. Activités (historique d'échanges) et tâches
-- ---------------------------------------------------------------------
create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts (id) on delete cascade,
  type text not null check (type in ('call', 'whatsapp', 'email', 'meeting', 'note', 'event', 'system')),
  body text not null check (length(body) between 1 and 4000),
  occurred_at timestamptz not null default now(),
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index crm_activities_contact_idx on public.crm_activities (contact_id, occurred_at desc);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.crm_contacts (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  due_on date not null,
  owner_id uuid references public.profiles (id) on delete set null,
  done_at timestamptz,
  -- rappel in-app déjà envoyé à la responsable
  reminded_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index crm_tasks_owner_idx on public.crm_tasks (owner_id, due_on) where done_at is null;
create index crm_tasks_contact_idx on public.crm_tasks (contact_id);

-- ---------------------------------------------------------------------
-- 4. Segments enregistrés (filtres combinables, en JSON)
-- ---------------------------------------------------------------------
create table public.crm_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  description text,
  filters jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. Sécurité : administratrices uniquement
-- ---------------------------------------------------------------------
alter table public.crm_contacts enable row level security;
alter table public.crm_stages enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_segments enable row level security;

create policy crm_contacts_admin on public.crm_contacts for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy crm_stages_admin on public.crm_stages for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy crm_deals_admin on public.crm_deals for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy crm_activities_admin on public.crm_activities for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy crm_tasks_admin on public.crm_tasks for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy crm_segments_admin on public.crm_segments for all using (public.has_role('admin')) with check (public.has_role('admin'));
revoke all on public.crm_contacts, public.crm_stages, public.crm_deals, public.crm_activities, public.crm_tasks, public.crm_segments from anon;

-- horodatage des modifications
create or replace function public.crm_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger crm_contacts_touch before update on public.crm_contacts for each row execute function public.crm_touch();
create trigger crm_deals_touch before update on public.crm_deals for each row execute function public.crm_touch();
create trigger crm_segments_touch before update on public.crm_segments for each row execute function public.crm_touch();

-- ---------------------------------------------------------------------
-- 6. Synchronisation : chaque profil de l'appli a sa fiche contact (sans doublon)
-- ---------------------------------------------------------------------
create or replace function public.crm_sync_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.crm_contacts (profile_id, first_name, last_name, email, phone, job, source, status, created_at)
  values (
    new.id,
    coalesce(new.first_name, ''),
    coalesce(new.last_name, ''),
    new.email,
    new.whatsapp,
    new.job,
    'appli',
    'prospect',
    new.created_at
  )
  on conflict (profile_id) do nothing;
  return new;
end $$;
create trigger crm_profile_created after insert on public.profiles for each row execute function public.crm_sync_profile();

-- profils déjà présents
insert into public.crm_contacts (profile_id, first_name, last_name, email, phone, job, source, status, created_at)
select id, first_name, last_name, email, whatsapp, job, 'appli', 'prospect', created_at from public.profiles
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------------
-- 7. Fusion de doublons (atomique) : la fiche « drop » est versée dans « keep » puis supprimée
-- ---------------------------------------------------------------------
create or replace function public.crm_merge_contacts(p_keep uuid, p_drop uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  k public.crm_contacts;
  d public.crm_contacts;
begin
  if not public.has_role('admin') then
    raise exception 'Réservé aux administratrices.' using errcode = '42501';
  end if;
  if p_keep = p_drop then
    raise exception 'Choisissez deux fiches différentes.';
  end if;
  select * into k from public.crm_contacts where id = p_keep for update;
  select * into d from public.crm_contacts where id = p_drop for update;
  if k.id is null or d.id is null then
    raise exception 'Fiche introuvable.';
  end if;
  if k.profile_id is not null and d.profile_id is not null then
    raise exception 'Les deux fiches sont reliées à deux comptes différents : fusion impossible.';
  end if;
  update public.crm_activities set contact_id = p_keep where contact_id = p_drop;
  update public.crm_tasks set contact_id = p_keep where contact_id = p_drop;
  update public.crm_deals set contact_id = p_keep where contact_id = p_drop;
  -- libère le lien au compte avant de le reporter (unicité de profile_id)
  update public.crm_contacts set profile_id = null where id = p_drop;
  update public.crm_contacts set
    profile_id = coalesce(k.profile_id, d.profile_id),
    organization_id = coalesce(k.organization_id, d.organization_id),
    first_name = case when k.first_name = '' then d.first_name else k.first_name end,
    last_name = case when k.last_name = '' then d.last_name else k.last_name end,
    company = coalesce(nullif(k.company, ''), d.company),
    job = coalesce(nullif(k.job, ''), d.job),
    email = coalesce(nullif(k.email, ''), d.email),
    phone = coalesce(nullif(k.phone, ''), d.phone),
    instagram = coalesce(nullif(k.instagram, ''), d.instagram),
    city = coalesce(nullif(k.city, ''), d.city),
    source = case when k.source in ('autre', 'import', 'appli') then d.source else k.source end,
    tags = array(select distinct unnest(k.tags || d.tags) order by 1),
    notes = left(trim(both e'\n' from k.notes || case when d.notes <> '' then e'\n\n' || d.notes else '' end), 8000),
    marketing_consent = k.marketing_consent or d.marketing_consent,
    consent_at = coalesce(k.consent_at, d.consent_at),
    owner_id = coalesce(k.owner_id, d.owner_id),
    created_at = least(k.created_at, d.created_at)
  where id = p_keep;
  delete from public.crm_contacts where id = p_drop;
  insert into public.crm_activities (contact_id, type, body, author_id)
  values (p_keep, 'system', 'Fiche fusionnée avec « ' || trim(d.first_name || ' ' || d.last_name || coalesce(' · ' || d.company, '')) || ' »', auth.uid());
  return p_keep;
end $$;
revoke execute on function public.crm_merge_contacts(uuid, uuid) from anon;

-- ---------------------------------------------------------------------
-- 8. Journal et notifications : nouveaux types d'objets et de notification
-- Les listes fermées de 0003 deviennent un format (minuscules et _), pour que chaque lot
-- puisse ajouter ses propres valeurs sans réécrire la liste des autres (l'application garde
-- les listes typées). Idempotent : peut être rejoué après une autre migration qui fait de même.
-- ---------------------------------------------------------------------
alter table public.audit_log drop constraint if exists audit_log_target_type_check;
alter table public.audit_log add constraint audit_log_target_type_check check (target_type ~ '^[a-z_]{1,40}$');

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type ~ '^[a-z_]{1,40}$');
alter table public.notification_prefs drop constraint if exists notification_prefs_type_check;
alter table public.notification_prefs add constraint notification_prefs_type_check check (type ~ '^[a-z_]{1,40}$');

-- ---------------------------------------------------------------------
-- 9. Étapes par défaut du pipeline
-- ---------------------------------------------------------------------
-- Identifiants fixes : les mêmes que les données d'exemple (src/lib/modules/crm/seed.ts).
insert into public.crm_stages (id, label, position, outcome) values
  ('00000000-0000-4000-a000-0000000c5001', 'Nouveau contact', 0, 'open'),
  ('00000000-0000-4000-a000-0000000c5002', 'Échange', 1, 'open'),
  ('00000000-0000-4000-a000-0000000c5003', 'Invitée à un événement', 2, 'open'),
  ('00000000-0000-4000-a000-0000000c5004', 'Proposition envoyée', 3, 'open'),
  ('00000000-0000-4000-a000-0000000c5005', 'Adhérente', 4, 'won'),
  ('00000000-0000-4000-a000-0000000c5006', 'Perdu', 5, 'lost')
on conflict (id) do nothing;


-- ===================== 0008_securite.sql =====================
-- =====================================================================
-- Nomad Club : sécurité, conformité et évolution (Lot 6)
-- Consentements horodatés, demandes de suppression de compte (file des administratrices),
-- anonymisation, limitation de fréquence, abonnements aux notifications push,
-- sessions de la personne connectée, double authentification des administratrices,
-- journal étendu (connexions admin, exports, suppressions) et durcissements issus de l'audit.
-- Ne dépend que de 0001 à 0003 (applicable dans n'importe quel ordre après 0003).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Durcissements (voir docs/securite/audit.md)
-- ---------------------------------------------------------------------

-- Supabase accorde EXECUTE à tout le monde sur les fonctions du schéma public :
-- les fonctions internes (appelées par d'autres fonctions ou par des déclencheurs) ne sont pas des API.
revoke execute on function public.new_ticket_code(timestamptz) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile() from public, anon, authenticated;
revoke execute on function public.keep_one_admin() from public, anon, authenticated;
revoke execute on function public.protect_organization() from public, anon, authenticated;
revoke execute on function public.notifications_respect_prefs() from public, anon, authenticated;

-- Code de billet plus long (6 caractères aléatoires au lieu de 4 : ~887 millions de combinaisons par date),
-- pour rendre l'énumération des billets (get_ticket est public) impraticable.
-- Le format accepté couvre les anciens billets (4 caractères) et les nouveaux (6).
alter table public.bookings drop constraint if exists bookings_ticket_code_check;
alter table public.bookings add constraint bookings_ticket_code_check check (ticket_code ~ '^NC-[0-9]{4}-[A-Z0-9]{4}([A-Z0-9]{2})?$');
create or replace function public.new_ticket_code(p_starts timestamptz) returns text
language plpgsql volatile set search_path = public as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := 'NC-' || to_char(p_starts at time zone 'Africa/Casablanca', 'DDMM') || '-';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bookings where ticket_code = code);
  end loop;
  return code;
end $$;
revoke execute on function public.new_ticket_code(timestamptz) from public, anon, authenticated;

-- Billet consultable par son code : n'expose plus l'identifiant du compte de la titulaire.
create or replace function public.get_ticket(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'booking', json_build_object('id', b.id, 'event_id', b.event_id, 'profile_id', null, 'guest_first_name', b.guest_first_name,
                                 'status', b.status, 'amount', b.amount, 'method', b.method, 'ticket_code', b.ticket_code, 'created_at', b.created_at),
    'event', to_json(e),
    'holder', coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), b.guest_first_name, 'Invitée')
  )
  from public.bookings b
  join public.events e on e.id = b.event_id
  left join public.profiles p on p.id = b.profile_id
  where b.ticket_code = upper(left(p_code, 20));
$$;
grant execute on function public.get_ticket(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. Réglages de sécurité (une seule ligne)
--    admin_mfa_enforced : la base exige une session AAL2 (double authentification)
--    pour les opérations sensibles des administratrices. À activer une fois toutes les admins enrôlées.
-- ---------------------------------------------------------------------
create table public.security_settings (
  id boolean primary key default true check (id),
  admin_mfa_enforced boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.security_settings (id) values (true) on conflict do nothing;

alter table public.security_settings enable row level security;
create policy security_settings_read on public.security_settings for select to authenticated using (public.has_role('admin'));
create policy security_settings_admin on public.security_settings for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
revoke all on public.security_settings from anon;

-- Niveau d'authentification de la session (claim « aal » du JWT Supabase : aal1 = lien magique, aal2 = + TOTP).
create or replace function public.session_aal() returns text
language sql stable set search_path = public as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', 'aal1');
$$;

-- Vrai si la double authentification n'est pas (encore) exigée par la base, ou si la session est en AAL2.
create or replace function public.admin_mfa_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select not coalesce((select admin_mfa_enforced from public.security_settings where id), false)
      or public.session_aal() = 'aal2';
$$;
grant execute on function public.session_aal() to anon, authenticated, service_role;
grant execute on function public.admin_mfa_ok() to authenticated, service_role;

-- Politiques restrictives (s'ajoutent en ET aux politiques existantes) : quand la base l'exige,
-- une administratrice sans double authentification ne change pas les rôles et ne lit pas le journal.
create policy user_roles_mfa_insert on public.user_roles as restrictive for insert to authenticated
  with check (not public.has_role('admin') or public.admin_mfa_ok());
create policy user_roles_mfa_update on public.user_roles as restrictive for update to authenticated
  using (not public.has_role('admin') or public.admin_mfa_ok());
create policy user_roles_mfa_delete on public.user_roles as restrictive for delete to authenticated
  using (not public.has_role('admin') or public.admin_mfa_ok());
create policy audit_log_mfa_read on public.audit_log as restrictive for select to authenticated
  using (not public.has_role('admin') or public.admin_mfa_ok());

-- ---------------------------------------------------------------------
-- 2. Consentements (historique horodaté, jamais modifié : l'état courant est la dernière ligne par type)
-- ---------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('geolocation', 'communications', 'directory', 'image')),
  granted boolean not null,
  source text not null default 'app' check (length(source) between 1 and 40),
  created_at timestamptz not null default now()
);
create index consents_profile_idx on public.consents (profile_id, kind, seq desc);

alter table public.consents enable row level security;
create policy consents_own_read on public.consents for select to authenticated using (profile_id = auth.uid());
create policy consents_own_insert on public.consents for insert to authenticated with check (profile_id = auth.uid());
create policy consents_admin_read on public.consents for select to authenticated using (public.has_role('admin'));
revoke update, delete, truncate on public.consents from anon, authenticated;
revoke all on public.consents from anon;

-- État courant (dernier choix par type).
create view public.current_consents with (security_invoker = on) as
  select distinct on (profile_id, kind) profile_id, kind, granted, created_at
    from public.consents
   order by profile_id, kind, seq desc;
revoke all on public.current_consents from anon;

-- Valeurs par défaut quand la personne n'a encore rien choisi (à valider avec la cliente) :
-- annuaire visible (cœur de l'adhésion, retirable), le reste refusé tant que la personne n'a pas accepté.
create or replace function public.consent_default(p_kind text) returns boolean
language sql immutable as $$
  select p_kind = 'directory';
$$;

-- Pour les autres lots (carte, annuaire…) : la personne a-t-elle donné ce consentement ?
create or replace function public.has_consent(p_profile uuid, p_kind text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select granted from public.consents where profile_id = p_profile and kind = p_kind order by seq desc limit 1),
    public.consent_default(p_kind)
  );
$$;
revoke all on function public.has_consent(uuid, text) from public, anon;
grant execute on function public.has_consent(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Demandes de suppression de compte
--    Délai de grâce de 30 jours (annulable), puis traitement par une administratrice :
--    anonymisation du profil et des messages, conservation légale des paiements.
-- ---------------------------------------------------------------------
create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reason text check (reason is null or length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'done', 'rejected')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '30 days'),
  processed_at timestamptz,
  processed_by uuid references public.profiles (id) on delete set null,
  admin_note text check (admin_note is null or length(admin_note) <= 500)
);
create unique index deletion_requests_one_pending on public.deletion_requests (profile_id) where status = 'pending';
create index deletion_requests_queue_idx on public.deletion_requests (status, scheduled_for);

alter table public.deletion_requests enable row level security;
-- chacune voit ses demandes ; seules les administratrices voient (et traitent) la file
create policy deletion_requests_own_read on public.deletion_requests for select to authenticated using (profile_id = auth.uid());
create policy deletion_requests_admin on public.deletion_requests for all to authenticated
  using (public.has_role('admin') and public.admin_mfa_ok()) with check (public.has_role('admin') and public.admin_mfa_ok());
revoke all on public.deletion_requests from anon;
-- une membre n'écrit pas directement : elle passe par request_account_deletion / cancel_account_deletion

create or replace function public.request_account_deletion(p_reason text default null) returns public.deletion_requests
language plpgsql security definer set search_path = public as $$
declare
  r public.deletion_requests;
begin
  if auth.uid() is null then raise exception 'login'; end if;
  select * into r from public.deletion_requests where profile_id = auth.uid() and status = 'pending';
  if found then return r; end if;
  insert into public.deletion_requests (profile_id, reason) values (auth.uid(), nullif(left(trim(coalesce(p_reason, '')), 500), ''))
  returning * into r;
  insert into public.audit_log (actor_id, action, target_type, target_id, summary, details)
  values (auth.uid(), 'account.delete_request', 'profile', auth.uid(), 'Demande de suppression de compte', json_build_object('scheduled_for', r.scheduled_for)::jsonb);
  return r;
end $$;

create or replace function public.cancel_account_deletion() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login'; end if;
  update public.deletion_requests set status = 'cancelled', processed_at = now() where profile_id = auth.uid() and status = 'pending';
  if not found then return false; end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, summary)
  values (auth.uid(), 'account.delete_cancel', 'profile', auth.uid(), 'Demande de suppression annulée');
  return true;
end $$;

-- Anonymisation (administratrice en AAL2 si exigé, ou clé service) : le compte devient « Ancienne membre ».
-- Conservés : paiements et réservations (obligations comptables), journal. Effacés : coordonnées,
-- textes des messages, notifications, préférences, consentements, abonnements push, rôles, rattachements.
create or replace function public.anonymize_account(p_profile uuid, p_request uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' and not (public.has_role('admin') and public.admin_mfa_ok()) then
    raise exception 'admin_only';
  end if;
  if p_profile = auth.uid() then raise exception 'not_self'; end if;
  if public.user_has_any_role(p_profile, array['admin']) then raise exception 'admin_account'; end if;

  perform set_config('nc.trusted', 'on', true);
  update public.profiles
     set first_name = 'Ancienne', last_name = 'membre', whatsapp = null, email = null, job = null, country = null,
         bio = null, avatar_url = null, marrakech_since = null, plan = 'free', plan_ends_at = null
   where id = p_profile;
  if not found then raise exception 'not_found'; end if;
  update public.messages set body = 'Message retiré (compte supprimé).' where author_id = p_profile;
  update public.bookings set guest_first_name = null, guest_whatsapp = null where profile_id = p_profile;
  delete from public.notifications where recipient_id = p_profile;
  delete from public.notification_prefs where profile_id = p_profile;
  delete from public.consents where profile_id = p_profile;
  delete from public.push_subscriptions where profile_id = p_profile;
  delete from public.reminders where profile_id = p_profile;
  delete from public.organization_members where profile_id = p_profile;
  delete from public.user_roles where profile_id = p_profile;
  update public.memberships set status = 'cancelled' where profile_id = p_profile and status = 'active';
  update public.deletion_requests
     set status = 'done', processed_at = now(), processed_by = auth.uid()
   where profile_id = p_profile and status = 'pending' and (p_request is null or id = p_request);
  perform set_config('nc.trusted', 'off', true);
end $$;

-- ---------------------------------------------------------------------
-- 4. Abonnements aux notifications push (Web Push, clés VAPID côté serveur)
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  user_agent text check (user_agent is null or length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
revoke all on public.push_subscriptions from anon;

-- ---------------------------------------------------------------------
-- 5. Limitation de fréquence (mode réel, appelée par le serveur avec la clé service)
--    Fenêtre fixe : compte les appels par clé (ex. « magic:ip:1.2.3.4 ») et refuse au-delà de la limite.
-- ---------------------------------------------------------------------
create table public.rate_limits (
  key text not null check (length(key) <= 200),
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into public.rate_limits (key, window_start, hits) values (left(p_key, 200), v_start, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  return json_build_object(
    'ok', v_hits <= p_limit,
    'remaining', greatest(0, p_limit - v_hits),
    'retry_after', ceil(extract(epoch from (v_start + make_interval(secs => p_window_seconds) - now())))::int
  );
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Ménage (tâche planifiée / cron) : fenêtres de plus d'un jour.
create or replace function public.purge_rate_limits() returns int
language sql security definer set search_path = public as $$
  with d as (delete from public.rate_limits where window_start < now() - interval '1 day' returning 1)
  select count(*)::int from d;
$$;
revoke all on function public.purge_rate_limits() from public, anon, authenticated;
grant execute on function public.purge_rate_limits() to service_role;

-- ---------------------------------------------------------------------
-- 6. Sessions de la personne connectée (table auth.sessions de Supabase)
--    plpgsql : le corps n'est résolu qu'à l'appel (auth.sessions n'existe que sur Supabase).
-- ---------------------------------------------------------------------
create or replace function public.my_sessions()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, ip text, aal text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  return query execute
    'select s.id, s.created_at, s.updated_at, s.user_agent::text, host(s.ip)::text, s.aal::text
       from auth.sessions s where s.user_id = $1 order by coalesce(s.updated_at, s.created_at) desc limit 20'
    using auth.uid();
end $$;
revoke all on function public.my_sessions() from public, anon;
grant execute on function public.my_sessions() to authenticated;

-- ---------------------------------------------------------------------
-- 7. Journal : une personne peut tracer ses propres opérations sensibles (export, consentements,
--    connexion, double authentification) — toujours en son nom et sur sa propre fiche.
-- ---------------------------------------------------------------------
create policy audit_log_self_insert on public.audit_log for insert to authenticated with check (
  actor_id = auth.uid()
  and target_type = 'profile'
  and target_id = auth.uid()
  and action in ('data.export', 'consent.update', 'auth.login', 'auth.admin_login', 'auth.mfa_enroll', 'auth.mfa_verify', 'auth.signout_all', 'push.subscribe')
);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);

grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.anonymize_account(uuid, uuid) to authenticated, service_role;
revoke execute on function public.request_account_deletion(text) from anon;
revoke execute on function public.cancel_account_deletion() from anon;
revoke execute on function public.anonymize_account(uuid, uuid) from anon;


-- ===================== 0009_paiements.sql =====================
-- =====================================================================
-- Vague 2 · chantier 2a — Paiements réels
-- Ne dépend que de 0001 à 0008.
--
-- 1. Sessions de paiement (checkouts) : une ligne par paiement lancé, quel que soit le prestataire
--    (Stripe, virement, simulé en démo). Le prestataire ne reçoit que l'identifiant de la ligne.
-- 2. Événements reçus des prestataires (webhooks) : stockés tels quels, traités une seule fois,
--    rejouables par une administratrice.
-- 3. Clients chez le prestataire (customer Stripe) d'une membre ou d'un établissement.
-- 4. Échéanciers d'adhésion (1, 3 ou 12 fois) et échéances.
-- 5. Grand livre des encaissements (toutes sources) et remboursements.
-- 6. Abonnement des pros : références de l'abonnement chez le prestataire.
-- 7. Accès membre suspendu / rétabli (impayé au-delà du délai de grâce).
-- Écriture : serveur uniquement (clé service). Lecture : chacune les siennes, l'équipe d'un établissement
-- les siennes, l'admin tout.
-- =====================================================================

-- Les types de notifications et de cibles du journal sont des formats (0007) : rien à étendre ici.
-- Par sécurité (ordre d'application quelconque), on remet le même format, idempotent.
alter table public.audit_log drop constraint if exists audit_log_target_type_check;
alter table public.audit_log add constraint audit_log_target_type_check check (target_type ~ '^[a-z_]{1,40}$');
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type ~ '^[a-z_]{1,40}$');
alter table public.notification_prefs drop constraint if exists notification_prefs_type_check;
alter table public.notification_prefs add constraint notification_prefs_type_check check (type ~ '^[a-z_]{1,40}$');

-- ---------------------------------------------------------------------
-- 1. Sessions de paiement
-- ---------------------------------------------------------------------
create table public.payment_checkouts (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'transfer', 'simulated', 'cmi')),
  kind text not null check (kind in ('booking', 'membership', 'shop', 'pro_subscription')),
  profile_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  -- objet payé : réservation, paiement d'adhésion (payments), produit, formule pro
  target_id text,
  plan text,
  installments smallint not null default 1 check (installments between 1 and 24),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'open' check (status in ('open', 'completed', 'expired', 'failed')),
  provider_ref text unique,
  subscription_ref text,
  customer_ref text,
  -- échéancier lié (adhésion)
  plan_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index payment_checkouts_profile_idx on public.payment_checkouts (profile_id, created_at desc);
create index payment_checkouts_subscription_idx on public.payment_checkouts (subscription_ref) where subscription_ref is not null;

-- ---------------------------------------------------------------------
-- 2. Événements des prestataires (idempotence : une ligne par identifiant d'événement)
-- ---------------------------------------------------------------------
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  attempts integer not null default 0 check (attempts >= 0),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);
create index payment_events_status_idx on public.payment_events (status, received_at desc);

-- ---------------------------------------------------------------------
-- 3. Clients chez le prestataire
-- ---------------------------------------------------------------------
create table public.payment_customers (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  customer_ref text not null,
  profile_id uuid references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint payment_customer_owner check ((profile_id is null) <> (organization_id is null)),
  unique (provider, customer_ref)
);
create unique index payment_customers_profile on public.payment_customers (provider, profile_id) where profile_id is not null;
create unique index payment_customers_org on public.payment_customers (provider, organization_id) where organization_id is not null;

-- ---------------------------------------------------------------------
-- 4. Échéanciers d'adhésion et échéances
-- ---------------------------------------------------------------------
create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- ligne « payments » de l'adhésion (validée au premier encaissement, ce qui ouvre l'adhésion)
  payment_id uuid references public.payments (id) on delete set null,
  plan text not null check (plan in ('member', 'premium')),
  membership_action text not null check (membership_action in ('join', 'renew', 'upgrade')),
  installments_count smallint not null check (installments_count between 1 and 24),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  provider text not null check (provider in ('stripe', 'transfer', 'simulated', 'cmi')),
  checkout_id uuid references public.payment_checkouts (id) on delete set null,
  subscription_ref text unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'late', 'suspended', 'completed', 'cancelled')),
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index installment_plans_profile_idx on public.installment_plans (profile_id, created_at desc);
create index installment_plans_status_idx on public.installment_plans (status);
alter table public.payment_checkouts add constraint payment_checkouts_plan_fk foreign key (plan_id) references public.installment_plans (id) on delete set null;

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.installment_plans (id) on delete cascade,
  -- copie de la titulaire (RLS simple et index)
  profile_id uuid not null references public.profiles (id) on delete cascade,
  seq smallint not null check (seq >= 1),
  amount numeric(12, 2) not null check (amount >= 0),
  due_date date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'paid', 'failed', 'late', 'cancelled', 'refunded')),
  paid_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  invoice_ref text unique,
  invoice_url text,
  invoice_pdf text,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, seq),
  constraint installment_paid_has_date check (status <> 'paid' or paid_at is not null)
);
create index installments_profile_idx on public.installments (profile_id, due_date);
create index installments_due_idx on public.installments (due_date) where status in ('scheduled', 'failed', 'late');

-- ---------------------------------------------------------------------
-- 5. Grand livre des encaissements et remboursements
-- ---------------------------------------------------------------------
create sequence public.payment_receipt_seq;

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'transfer', 'simulated', 'cmi')),
  kind text not null check (kind in ('membership', 'installment', 'booking', 'pro_subscription', 'shop')),
  profile_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 0),
  amount_refunded numeric(12, 2) not null default 0 check (amount_refunded >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'succeeded' check (status in ('succeeded', 'refunded', 'partially_refunded')),
  description text not null,
  -- référence chez le prestataire (session, facture, paiement) : une seule écriture par référence
  provider_ref text,
  charge_ref text,
  invoice_url text,
  invoice_pdf text,
  receipt_number text not null unique default ('NC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.payment_receipt_seq')::text, 6, '0')),
  related_type text check (related_type ~ '^[a-z_]{1,40}$'),
  related_id text,
  created_at timestamptz not null default now(),
  constraint refund_not_above check (amount_refunded <= amount)
);
create unique index payment_transactions_ref on public.payment_transactions (provider, provider_ref) where provider_ref is not null;
create index payment_transactions_profile_idx on public.payment_transactions (profile_id, created_at desc);
create index payment_transactions_org_idx on public.payment_transactions (organization_id, created_at desc);
create index payment_transactions_charge_idx on public.payment_transactions (charge_ref) where charge_ref is not null;

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.payment_transactions (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  reason text,
  provider_ref text unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payment_refunds_tx_idx on public.payment_refunds (transaction_id);

-- ---------------------------------------------------------------------
-- 6. Abonnement des pros : références chez le prestataire
-- ---------------------------------------------------------------------
alter table public.pro_subscriptions add column if not exists provider text not null default 'simulated';
alter table public.pro_subscriptions add column if not exists subscription_ref text unique;
alter table public.pro_subscriptions add column if not exists customer_ref text;

-- ---------------------------------------------------------------------
-- 7. Accès membre suspendu (impayé) puis rétabli
-- ---------------------------------------------------------------------
-- Retire (ou rend) le rôle « member » d'une adhérente dont l'échéancier est suspendu.
-- Les administratrices gardent toujours leur accès. Clé service uniquement.
create or replace function public.pay_set_member_access(p_profile uuid, p_active boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.user_has_any_role(p_profile, array['admin']) then return false; end if;
  if p_active then
    insert into public.user_roles (profile_id, role) values (p_profile, 'member') on conflict do nothing;
  else
    delete from public.user_roles where profile_id = p_profile and role = 'member';
  end if;
  return true;
end $$;
revoke all on function public.pay_set_member_access(uuid, boolean) from public, anon, authenticated;
grant execute on function public.pay_set_member_access(uuid, boolean) to service_role;

-- Encaissements par mois et par type (pilotage des fondatrices ; la RLS des transactions s'applique).
create view public.payment_revenue_by_month with (security_invoker = on) as
  select date_trunc('month', created_at at time zone 'Africa/Casablanca')::date as month,
         kind,
         currency,
         sum(amount - amount_refunded)::numeric(12, 2) as net,
         count(*)::int as count
    from public.payment_transactions
   group by 1, 2, 3;
revoke all on public.payment_revenue_by_month from anon;

-- ---------------------------------------------------------------------
-- Sécurité ligne par ligne
-- ---------------------------------------------------------------------
alter table public.payment_checkouts enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_customers enable row level security;
alter table public.installment_plans enable row level security;
alter table public.installments enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_refunds enable row level security;

-- Chacune voit ses sessions, ses échéanciers, ses échéances ; l'admin voit et corrige tout.
create policy payment_checkouts_own on public.payment_checkouts for select to authenticated using (profile_id = auth.uid());
create policy payment_checkouts_admin on public.payment_checkouts for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy installment_plans_own on public.installment_plans for select to authenticated using (profile_id = auth.uid());
create policy installment_plans_admin on public.installment_plans for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy installments_own on public.installments for select to authenticated using (profile_id = auth.uid());
create policy installments_admin on public.installments for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- Encaissements : les siens, ceux de son établissement (pro / partenaire), tout pour l'admin.
create policy payment_transactions_own on public.payment_transactions for select to authenticated using (
  profile_id = auth.uid() or (organization_id is not null and public.is_org_member(organization_id))
);
create policy payment_transactions_admin on public.payment_transactions for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy payment_refunds_own on public.payment_refunds for select to authenticated using (
  exists (select 1 from public.payment_transactions t where t.id = transaction_id
           and (t.profile_id = auth.uid() or (t.organization_id is not null and public.is_org_member(t.organization_id))))
);
create policy payment_refunds_admin on public.payment_refunds for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- Événements bruts et clients du prestataire : administratrices seulement (lecture), serveur pour l'écriture.
create policy payment_events_admin_read on public.payment_events for select using (public.has_role('admin'));
create policy payment_customers_admin_read on public.payment_customers for select using (public.has_role('admin'));

-- Rien n'est modifiable par une personne connectée hors administratrice ; les visiteuses ne voient rien.
revoke all on public.payment_checkouts, public.payment_events, public.payment_customers, public.installment_plans,
  public.installments, public.payment_transactions, public.payment_refunds from anon;
revoke insert, update, delete on public.payment_events, public.payment_customers from authenticated;


-- ===================== 0010_contrats.sql =====================
-- =====================================================================
-- Nomad Club : contrats (vague 2, chantier 2b)
-- Modèles versionnés (adhésion, partenaire, pro), contrats générés par souscription (numéro unique,
-- texte rendu, empreinte SHA-256 du PDF), preuves d'acceptation électronique immuables, stockage privé.
-- Ne dépend que de 0001 à 0008.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Cibles du journal et types de notifications : depuis 0007, ce sont des formats (^[a-z_]{1,40}$) qui
--    acceptent déjà « contract », « contract_template », « contract_ready », « contract_accepted ».
--    Si une base avait encore des listes fermées (IN / ANY), on y ajoute nos valeurs.
-- ---------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in select * from (values
    ('audit_log', 'target_type', array['contract', 'contract_template']),
    ('notifications', 'type', array['contract_ready', 'contract_accepted']),
    ('notification_prefs', 'type', array['contract_ready', 'contract_accepted'])
  ) as v(tbl, col, vals)
  loop
    if exists (
      select 1 from pg_constraint con join pg_class rel on rel.oid = con.conrelid
       where rel.relname = t.tbl and con.contype = 'c' and pg_get_constraintdef(con.oid) ~ ('\m' || t.col || '\M') and pg_get_constraintdef(con.oid) ~ 'ANY|IN \('
    ) and exists (select 1 from pg_proc where proname = 'nc_extend_check') then
      perform public.nc_extend_check(t.tbl, t.col, t.vals);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 1. Modèles de contrat versionnés
-- ---------------------------------------------------------------------
create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('membership', 'partner', 'pro')),
  version int not null check (version > 0),
  title text not null check (char_length(title) between 3 and 160),
  body_md text not null check (char_length(body_md) between 50 and 200000),
  effective_from date not null default current_date,
  is_active boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (kind, version)
);
-- une seule version active par type
create unique index if not exists contract_templates_one_active on public.contract_templates (kind) where is_active;

-- Un modèle déjà utilisé par un contrat ne change plus (le contrat garde sa version) ; seule l'activation bouge.
create or replace function public.protect_contract_template() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.contracts where template_id = old.id) then
      raise exception 'Modèle utilisé par des contrats : il ne peut pas être supprimé.';
    end if;
    return old;
  end if;
  if new.kind is distinct from old.kind or new.version is distinct from old.version then
    raise exception 'Le type et le numéro de version d''un modèle ne changent pas.';
  end if;
  if (new.body_md is distinct from old.body_md or new.title is distinct from old.title)
     and exists (select 1 from public.contracts where template_id = old.id) then
    raise exception 'Modèle déjà utilisé : créez une nouvelle version.';
  end if;
  return new;
end $$;

-- Activer une version : désactive les autres versions du même type (administratrices).
create or replace function public.activate_contract_template(p_id uuid) returns public.contract_templates
language plpgsql security definer set search_path = public as $$
declare
  t public.contract_templates;
begin
  if not (public.has_role('admin') or auth.role() = 'service_role') then
    raise exception 'Réservé aux administratrices.';
  end if;
  select * into t from public.contract_templates where id = p_id for update;
  if not found then raise exception 'Modèle introuvable.'; end if;
  update public.contract_templates set is_active = false where kind = t.kind and is_active and id <> p_id;
  update public.contract_templates set is_active = true, activated_at = now() where id = p_id returning * into t;
  return t;
end $$;

-- ---------------------------------------------------------------------
-- 2. Contrats (un par souscription)
-- ---------------------------------------------------------------------
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  number text not null unique check (number ~ '^NC-(ADH|PAR|PRO)-[0-9]{4}-[A-Z0-9]{6}$'),
  kind text not null check (kind in ('membership', 'partner', 'pro')),
  template_id uuid not null references public.contract_templates (id) on delete restrict,
  template_version int not null,
  profile_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  plan text not null check (char_length(plan) between 1 and 40),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  installments int not null default 1 check (installments between 1 and 12),
  schedule jsonb not null default '[]'::jsonb check (jsonb_typeof(schedule) = 'array'),
  starts_on date not null,
  ends_on date,
  variables jsonb not null default '{}'::jsonb check (jsonb_typeof(variables) = 'object'),
  body_md text not null,
  pdf_sha256 text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_path text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  subscription_ref text check (subscription_ref is null or char_length(subscription_ref) <= 120),
  source text not null default 'checkout' check (source in ('checkout', 'subscription', 'admin', 'seed')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  reminded_at timestamptz,
  reminder_count int not null default 0 check (reminder_count >= 0)
);
create index if not exists contracts_profile_idx on public.contracts (profile_id, created_at desc);
create index if not exists contracts_org_idx on public.contracts (organization_id, created_at desc);
create index if not exists contracts_status_idx on public.contracts (status, created_at desc);

-- Cohérence avec le modèle (type, version) et règles de cycle de vie :
-- - un contrat naît « en attente » (les données d'exemple et la clé service peuvent fixer une autre valeur
--   seulement via l'acceptation, voir accept_contract) ;
-- - « accepté » exige une preuve d'acceptation ; après acceptation, rien du contenu ne change
--   (texte, variables, montants, empreinte…), seuls la référence de souscription, les relances et
--   l'annulation (résiliation) restent possibles ;
-- - « annulé » est définitif.
create or replace function public.protect_contract() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tpl public.contract_templates;
begin
  if tg_op = 'INSERT' then
    select * into tpl from public.contract_templates where id = new.template_id;
    if not found or tpl.kind <> new.kind then raise exception 'Modèle de contrat incohérent.'; end if;
    new.template_version := tpl.version;
    if new.status <> 'pending' then raise exception 'Un contrat est créé « en attente » ; il devient « accepté » par accept_contract().'; end if;
    new.accepted_at := null;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status = 'accepted' or exists (select 1 from public.contract_acceptances where contract_id = old.id) then
      raise exception 'Un contrat accepté est conservé (preuve) : il ne peut pas être supprimé.';
    end if;
    return old;
  end if;
  -- UPDATE
  if old.status = 'cancelled' and new.status <> 'cancelled' then raise exception 'Un contrat annulé le reste.'; end if;
  if new.status = 'accepted' and old.status <> 'accepted' then
    if not exists (select 1 from public.contract_acceptances where contract_id = old.id) then
      raise exception 'Acceptation sans preuve refusée : utiliser accept_contract().';
    end if;
  end if;
  if new.status = 'pending' and old.status <> 'pending' then raise exception 'Retour « en attente » impossible.'; end if;
  if new.number is distinct from old.number or new.kind is distinct from old.kind or new.template_id is distinct from old.template_id
     or new.template_version is distinct from old.template_version or new.created_at is distinct from old.created_at then
    raise exception 'Numéro, type, modèle et date de création d''un contrat ne changent pas.';
  end if;
  if old.status <> 'pending' and (
       new.plan is distinct from old.plan or new.amount is distinct from old.amount or new.currency is distinct from old.currency
       or new.installments is distinct from old.installments or new.schedule is distinct from old.schedule
       or new.starts_on is distinct from old.starts_on or new.ends_on is distinct from old.ends_on
       or new.variables is distinct from old.variables or new.body_md is distinct from old.body_md
       or new.pdf_sha256 is distinct from old.pdf_sha256 or new.accepted_at is distinct from old.accepted_at
       or (new.pdf_path is distinct from old.pdf_path and old.pdf_path is not null)
     ) then
    raise exception 'Contrat accepté ou annulé : son contenu ne peut plus être modifié.';
  end if;
  -- le signataire et l'établissement ne changent pas, sauf effacement automatique (compte ou établissement supprimé)
  if (new.profile_id is distinct from old.profile_id and new.profile_id is not null)
     or (new.organization_id is distinct from old.organization_id and new.organization_id is not null) then
    raise exception 'La signataire et l''établissement d''un contrat ne changent pas.';
  end if;
  if new.subscription_ref is distinct from old.subscription_ref and old.subscription_ref is not null then
    raise exception 'Contrat déjà relié à une souscription.';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Preuves d'acceptation (jamais modifiées ni supprimées, même par une administratrice ou la clé service)
-- ---------------------------------------------------------------------
create table if not exists public.contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null unique references public.contracts (id) on delete restrict,
  -- pas de clé étrangère : la preuve survit à la suppression d'un compte (l'identité est figée ci-dessous)
  profile_id uuid,
  signer_name text not null check (char_length(signer_name) between 1 and 200),
  signer_email text check (signer_email is null or char_length(signer_email) <= 320),
  accepted_at timestamptz not null default now(),
  ip text check (ip is null or char_length(ip) <= 64),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  template_version int not null,
  pdf_sha256 text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  provider text not null default 'simple' check (provider ~ '^[a-z_]{1,30}$'),
  provider_ref text check (provider_ref is null or char_length(provider_ref) <= 200),
  method text not null default 'checkbox' check (method ~ '^[a-z_]{1,30}$'),
  statement text not null check (char_length(statement) between 10 and 500)
);

create or replace function public.contract_acceptance_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Une preuve d''acceptation ne peut être ni modifiée ni supprimée.';
end $$;

-- Acceptation : la signataire elle-même (ou la clé service, pour un prestataire de signature), contrat en
-- attente, empreinte identique à celle du PDF généré. L'adresse IP et le navigateur sont relevés par le
-- serveur de l'appli. Journalisé ici (la personne n'a pas le droit d'écrire dans le journal).
create or replace function public.accept_contract(
  p_contract uuid, p_pdf_sha256 text, p_ip text, p_user_agent text, p_statement text,
  p_provider text default 'simple', p_provider_ref text default null
) returns public.contract_acceptances
language plpgsql security definer set search_path = public as $$
declare
  c public.contracts;
  me uuid := auth.uid();
  service boolean := auth.role() = 'service_role';
  a public.contract_acceptances;
  who text;
  mail text;
begin
  select * into c from public.contracts where id = p_contract for update;
  if not found then raise exception 'Contrat introuvable.'; end if;
  if not service and (me is null or c.profile_id is distinct from me) then
    raise exception 'Seule la signataire peut accepter ce contrat.';
  end if;
  if c.status <> 'pending' then raise exception 'Ce contrat n''est plus en attente d''acceptation.'; end if;
  if p_pdf_sha256 is distinct from c.pdf_sha256 then raise exception 'Empreinte différente : le document a changé.'; end if;
  if not service and coalesce(p_provider, 'simple') <> 'simple' then raise exception 'Prestataire de signature réservé au serveur.'; end if;
  select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), email into who, mail from public.profiles where id = c.profile_id;
  insert into public.contract_acceptances (contract_id, profile_id, signer_name, signer_email, ip, user_agent, template_version, pdf_sha256, provider, provider_ref, statement)
  values (c.id, c.profile_id, coalesce(who, c.variables ->> 'signataire.nom', 'Signataire'), mail, left(p_ip, 64), left(p_user_agent, 512), c.template_version, c.pdf_sha256,
          coalesce(p_provider, 'simple'), p_provider_ref, p_statement)
  returning * into a;
  update public.contracts set status = 'accepted', accepted_at = a.accepted_at where id = c.id;
  insert into public.audit_log (actor_id, action, target_type, target_id, summary, details)
  values (coalesce(me, c.profile_id), 'contract.accept', 'contract', c.id, 'Contrat ' || c.number || ' accepté',
          jsonb_build_object('number', c.number, 'version', c.template_version, 'sha256', c.pdf_sha256, 'provider', a.provider));
  return a;
end $$;

-- ---------------------------------------------------------------------
-- 4. Déclencheurs (créés après les tables qu'ils lisent)
-- ---------------------------------------------------------------------
drop trigger if exists contract_templates_protect on public.contract_templates;
create trigger contract_templates_protect before update or delete on public.contract_templates
  for each row execute function public.protect_contract_template();
drop trigger if exists contracts_protect on public.contracts;
create trigger contracts_protect before insert or update or delete on public.contracts
  for each row execute function public.protect_contract();
drop trigger if exists contract_acceptances_immutable on public.contract_acceptances;
create trigger contract_acceptances_immutable before update or delete on public.contract_acceptances
  for each row execute function public.contract_acceptance_immutable();

revoke execute on function public.protect_contract_template() from public, anon, authenticated;
revoke execute on function public.protect_contract() from public, anon, authenticated;
revoke execute on function public.contract_acceptance_immutable() from public, anon, authenticated;
revoke all on function public.activate_contract_template(uuid) from public, anon;
grant execute on function public.activate_contract_template(uuid) to authenticated, service_role;
revoke all on function public.accept_contract(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.accept_contract(uuid, text, text, text, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Sécurité ligne par ligne
--    Modèles : lecture des versions actives par toute personne connectée (texte affiché avant de souscrire),
--    tout le reste réservé aux administratrices.
--    Contrats et preuves : la signataire, la propriétaire de l'établissement concerné, les administratrices.
--    Écriture des contrats : administratrices (et clé service : génération après souscription).
--    Aucune écriture directe des preuves : accept_contract() seulement.
-- ---------------------------------------------------------------------
alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_acceptances enable row level security;

drop policy if exists contract_templates_read on public.contract_templates;
create policy contract_templates_read on public.contract_templates for select to authenticated
  using (is_active or public.has_role('admin'));
drop policy if exists contract_templates_admin on public.contract_templates;
create policy contract_templates_admin on public.contract_templates for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create or replace function public.can_read_contract(p_profile uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    p_profile = auth.uid()
    or (p_org is not null and public.is_org_member(p_org, array['owner']))
    or public.has_role('admin')
  );
$$;
revoke all on function public.can_read_contract(uuid, uuid) from public, anon;
grant execute on function public.can_read_contract(uuid, uuid) to authenticated, service_role;

drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts for select to authenticated
  using (public.can_read_contract(profile_id, organization_id));
drop policy if exists contracts_admin_insert on public.contracts;
create policy contracts_admin_insert on public.contracts for insert to authenticated
  with check (public.has_role('admin'));
drop policy if exists contracts_admin_update on public.contracts;
create policy contracts_admin_update on public.contracts for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists contract_acceptances_read on public.contract_acceptances;
create policy contract_acceptances_read on public.contract_acceptances for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and public.can_read_contract(c.profile_id, c.organization_id)));

revoke all on public.contract_templates, public.contracts, public.contract_acceptances from anon;
revoke insert, update, delete, truncate on public.contract_acceptances from authenticated;
revoke delete, truncate on public.contracts from authenticated;

-- ---------------------------------------------------------------------
-- 6. Stockage des PDF (Supabase Storage, bucket privé « contrats ») : URL signées à durée courte.
--    Ignoré si le schéma storage n'existe pas (banc de test local).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('contrats', 'contrats', false) on conflict (id) do nothing;
    execute $p$create policy contrats_read on storage.objects for select to authenticated using (
      bucket_id = 'contrats' and exists (
        select 1 from public.contracts c
         where c.pdf_path = storage.objects.name and public.can_read_contract(c.profile_id, c.organization_id)
      )
    )$p$;
    execute $p$create policy contrats_admin_write on storage.objects for insert to authenticated
      with check (bucket_id = 'contrats' and public.has_role('admin'))$p$;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. Modèles initiaux (version 1, actifs) — BROUILLONS à faire valider par un juriste.
--    Bloc généré par `node scripts/contrats-templates-sql.mjs` depuis src/lib/modules/contrats/templates.ts
--    (npm run test:sql vérifie que les deux textes sont identiques).
-- ---------------------------------------------------------------------
-- <modeles-initiaux>
insert into public.contract_templates (id, kind, version, title, body_md, effective_from, is_active, notes, activated_at)
values ('0c0a0000-0000-4000-a000-000000000001', 'membership', 1, 'Contrat d''adhésion (Membre / Premium)', $modele$>> BROUILLON — à faire valider par un juriste. Ce texte est un point de départ rédigé pour l'application : il n'a aucune valeur juridique tant qu'il n'a pas été relu, complété et validé. Les mentions entre crochets sont à compléter par le club avant d'activer une nouvelle version.
>> Droit applicable : les passages marqués [MAROC] et [FRANCE] changent selon que l'entité qui encaisse est marocaine (loi 31-08 sur la protection du consommateur, loi 09-08 et CNDP, loi 53-05 sur l'échange électronique de données juridiques) ou française (Code de la consommation, RGPD et CNIL, articles 1366 et 1367 du Code civil). Garder une seule variante avant activation.
>> Échéancier : la cliente veut permettre le paiement en une, trois ou douze fois. Préciser s'il y a des frais de paiement fractionné et ce qui se passe en cas d'impayé (article 3).

# Contrat d'adhésion au Nomad Club

Contrat n° {{contrat.numero}} · établi le {{contrat.date}} · modèle version {{modele.version}}

## Entre les soussignées

**Le club** : [RAISON SOCIALE], [FORME JURIDIQUE] au capital de [CAPITAL], dont le siège est situé [SIÈGE], immatriculée sous le numéro [ICE / SIREN], représentée par [REPRÉSENTANTE LÉGALE], ci-après « le Club » ou « {{club.nom}} ».

**La membre** : {{signataire.nom}}, joignable à l'adresse {{signataire.email}} et au {{signataire.telephone}}, carte de membre {{signataire.carte}}, ci-après « la Membre ».

## Article 1 — Objet

Le présent contrat définit les conditions dans lesquelles la Membre adhère au {{club.nom}}, cercle de femmes entrepreneuses installées à Marrakech, avec la formule **{{formule.nom}}**.

Pendant toute la durée de l'adhésion, la Membre a accès à l'application du club (espace membre, annuaire, messagerie et groupes, carnet d'adresses, carte, offres partenaires, ressources digitales, Espace Business, parrainage) et aux rendez-vous du club aux conditions de sa formule.

Ce que comprend la formule {{formule.nom}} : {{formule.avantages}}

## Article 2 — Durée

L'adhésion est conclue pour une durée d'un (1) an, du {{dates.debut}} au {{dates.fin}}. Elle prend effet au premier paiement, ou à la validation du virement par le Club.

## Article 3 — Prix et échéancier

Le prix de l'adhésion est de **{{montant.total}}** (devise : {{montant.devise}}), toutes taxes comprises [TVA : préciser le régime applicable].

Il est payable en {{echeancier.nombre}}, selon l'échéancier suivant :

{{echeancier.detail}}

Le paiement en plusieurs fois ne modifie pas la durée de l'engagement : les échéances restent dues jusqu'au terme prévu, sauf rétractation (article 6) ou résiliation dans les cas prévus à l'article 5. [FRAIS : aucun frais de paiement fractionné — à confirmer.]

En cas d'échéance impayée, le Club adresse une relance. Si l'échéance n'est pas réglée dans un délai de [15] jours après la relance, le Club peut suspendre l'accès à l'application jusqu'à la régularisation ; la suspension ne prolonge pas la durée de l'adhésion.

## Article 4 — Renouvellement

L'adhésion n'est pas reconduite tacitement. Le Club informe la Membre au moins [30] jours avant l'échéance ; la Membre renouvelle si elle le souhaite, depuis son espace. Chaque renouvellement donne lieu à un nouveau contrat, établi selon le modèle en vigueur à cette date.

>> [FRANCE] Si une reconduction tacite était choisie, l'article L215-1 du Code de la consommation imposerait d'informer la consommatrice par écrit, entre trois mois et un mois avant le terme, de la possibilité de ne pas reconduire. Le choix « sans reconduction tacite » évite cette obligation.

## Article 5 — Résiliation

**5.1 Par la Membre.** La Membre peut mettre fin à son adhésion à tout moment, depuis son espace ou par écrit à [E-MAIL DE CONTACT DU CLUB]. Sauf manquement du Club, les sommes déjà versées restent acquises et les échéances restantes [restent dues / sont annulées — à trancher].

**5.2 Par le Club.** En cas de manquement grave aux règles de vie (article 7), le Club peut résilier l'adhésion après une mise en demeure restée sans effet pendant [8] jours. En cas de harcèlement, de propos haineux, de fraude ou de mise en danger d'autres membres, le Club peut suspendre l'accès immédiatement, puis résilier. [REMBOURSEMENT : au prorata de la période restante ou non — à trancher.]

>> À trancher avec le juriste : conséquences financières d'une résiliation anticipée à l'initiative de la Membre (échéances restantes dues ou non) et clause pénale éventuelle, encadrée dans les deux droits (clauses abusives : loi 31-08 art. 15 et suivants ; Code de la consommation art. L212-1 et R212-1).

## Article 6 — Droit de rétractation

[MAROC] Conformément à l'article 36 de la loi n° 31-08 édictant des mesures de protection du consommateur, la Membre dispose d'un délai de sept (7) jours à compter de l'acceptation du présent contrat pour se rétracter, sans avoir à se justifier ni à payer de pénalité.

[FRANCE] Conformément aux articles L221-18 et suivants du Code de la consommation, la Membre dispose d'un délai de quatorze (14) jours à compter de l'acceptation du présent contrat pour se rétracter, sans avoir à se justifier ni à payer de pénalité. Si elle demande expressément à accéder aux services avant la fin de ce délai, elle reste redevable, en cas de rétractation, d'un montant proportionnel au service fourni (article L221-25).

La rétractation s'exerce par un message écrit à [E-MAIL DE CONTACT DU CLUB] ou depuis l'application. Le Club rembourse la totalité des sommes versées dans un délai de [14] jours, par le même moyen de paiement.

>> [MAROC] Loi 31-08, art. 36 : sept jours, portés à trente jours si le professionnel n'a pas fourni les informations prévues à l'article 29. Vérifier l'application au contrat d'adhésion conclu en ligne.
>> [FRANCE] Quatorze jours ; le formulaire type de rétractation (annexe de l'article R221-1) doit être joint au contrat : annexe à ajouter.

## Article 7 — Règles de vie et modération

Le club repose sur la bienveillance et la confiance. La Membre s'engage à :

- respecter les autres membres, partenaires et professionnelles, dans l'application comme lors des rendez-vous ;
- garder confidentiels les échanges du cercle (salon, groupes, messages privés) et les coordonnées de l'annuaire ;
- ne pas utiliser l'annuaire ni la messagerie pour du démarchage insistant ou de la publicité non sollicitée ;
- ne publier aucun contenu illicite, haineux, diffamatoire, ou portant atteinte à la vie privée ou aux droits d'autrui.

Le Club et ses modératrices peuvent masquer un message, adresser un avertissement, retirer l'accès à un groupe ou suspendre un compte. La messagerie utilise un filtrage par mots-clés et les signalements des membres. La Membre reste seule responsable des contenus qu'elle publie.

## Article 8 — Données personnelles et géolocalisation

Le responsable du traitement est [RAISON SOCIALE]. Le Club traite les données nécessaires à l'adhésion (identité, coordonnées, profil d'annuaire, adhésion et paiements, réservations, messages, contrats) pour exécuter le présent contrat, respecter ses obligations légales et, avec le consentement de la Membre, lui adresser des communications.

**Géolocalisation.** La position de la Membre n'est affichée sur la carte du club qu'avec son consentement exprès, de façon approximative (quartier ou environ 500 mètres), avec ou sans son nom. Elle peut retirer ce consentement à tout moment : sa position est alors effacée.

L'annuaire, les communications et le droit à l'image (article 9) font l'objet de réglages distincts, modifiables à tout moment dans « Mes données ». Les données sont conservées pendant la durée de l'adhésion puis [3] ans pour la relation avec les anciennes membres ; les contrats et paiements sont conservés pendant la durée légale [10 ans — à confirmer]. La Membre peut accéder à ses données, les rectifier, les télécharger, s'opposer à un traitement ou demander la suppression de son compte depuis « Mes données » ou à [E-MAIL DE CONTACT DONNÉES PERSONNELLES].

[MAROC] Traitement déclaré auprès de la Commission nationale de contrôle de la protection des données à caractère personnel (CNDP), conformément à la loi n° 09-08, sous le numéro [N° DE DÉCLARATION CNDP].
[FRANCE] Traitement conforme au règlement (UE) 2016/679 (RGPD) ; la Membre peut introduire une réclamation auprès de la CNIL.

Les données sont hébergées par [HÉBERGEURS ET PAYS : Supabase, Vercel…].

>> [MAROC] Hébergement hors du Maroc : le transfert de données vers l'étranger peut nécessiter une autorisation préalable de la CNDP (loi 09-08, articles 43 et 44). À vérifier.
>> [FRANCE] Transferts hors Union européenne : documenter le cadre (clauses contractuelles types, cadre UE–États-Unis) dans le registre des traitements.

## Article 9 — Droit à l'image

Des photos et vidéos peuvent être prises lors des rendez-vous du club. Le Club n'utilise l'image de la Membre (application, site, réseaux sociaux du club) qu'avec son consentement, donné ou retiré à tout moment dans « Mes données ». Sans ce consentement, le Club ne publie pas les images où la Membre est reconnaissable, ou les floute. Aucune image n'est cédée à des tiers à des fins commerciales.

## Article 10 — Parrainage

La Membre dispose d'un code personnel de parrainage. Les récompenses sont attribuées selon les règles affichées dans l'application au moment où la filleule devient membre. Elles n'ont pas de valeur monétaire et ne peuvent être échangées contre de l'argent. Le Club peut faire évoluer ou arrêter le programme pour l'avenir ; un parrainage frauduleux est annulé.

## Article 11 — Espace Business

L'Espace Business permet aux membres de déclarer les affaires conclues entre elles. **Le Club ne prélève aucune commission sur ces affaires et n'y est pas partie** : il ne garantit ni la qualité, ni l'exécution, ni le paiement des prestations, et n'est pas responsable des litiges entre membres. Les points attribués sont symboliques et sans valeur monétaire. La Membre s'engage à ne déclarer que des affaires réelles ; elle peut se retirer du classement à tout moment.

## Article 12 — Offres partenaires et carnet d'adresses

Les offres des partenaires et les fiches des professionnelles du carnet sont proposées sous la seule responsabilité de ces établissements. Le Club les sélectionne avec soin mais ne garantit pas leurs prestations ; leur référencement ne constitue pas une recommandation personnalisée.

## Article 13 — Marque et contenus

La marque {{club.nom}}, son logo, l'application et les ressources digitales sont protégés. La Membre peut les utiliser pour son usage personnel ; elle ne peut ni les reproduire, ni les revendre, ni se présenter comme représentante du club, ni utiliser la marque sans l'accord écrit du Club.

## Article 14 — Responsabilité

Le Club est tenu d'une obligation de moyens. Il s'efforce d'assurer l'accès à l'application en continu, sans pouvoir le garantir (maintenance, panne, force majeure). Lors des rendez-vous organisés chez des établissements tiers, chaque établissement reste responsable de ses propres prestations. [LIMITATION DE RESPONSABILITÉ : à préciser dans les limites permises par le droit de la consommation.]

## Article 15 — Acceptation électronique et preuve

La Membre accepte le présent contrat en cochant la case « J'ai lu et j'accepte » dans l'application. Le Club conserve, à titre de preuve, la date et l'heure de l'acceptation, l'adresse IP, le navigateur utilisé, la version du modèle et l'empreinte numérique (SHA-256) du document PDF accepté. Les parties reconnaissent à cette acceptation la même valeur qu'une signature manuscrite.

[MAROC] Conformément à la loi n° 53-05 relative à l'échange électronique de données juridiques.
[FRANCE] Conformément aux articles 1366 et 1367 du Code civil.

Une copie du contrat au format PDF est envoyée par e-mail après l'acceptation et reste disponible à tout moment dans l'espace « Mes contrats ».

>> Une signature électronique qualifiée ou avancée (Yousign, Docusign) peut remplacer la case à cocher sans changer le texte ; à décider avec le juriste selon le niveau de preuve souhaité.

## Article 16 — Évolution des conditions

Le Club peut faire évoluer les présentes conditions. Les nouvelles versions s'appliquent aux nouvelles adhésions et aux renouvellements ; un contrat en cours garde la version acceptée, sauf évolution imposée par la loi.

## Article 17 — Droit applicable et litiges

Le présent contrat est régi par le droit [DROIT APPLICABLE : Maroc ou France]. Avant toute action, les parties recherchent une solution amiable : toute réclamation est adressée par écrit à [E-MAIL DE CONTACT DU CLUB], qui y répond sous [15] jours.

[FRANCE] La Membre peut recourir gratuitement au médiateur de la consommation [NOM ET COORDONNÉES DU MÉDIATEUR], conformément à l'article L612-1 du Code de la consommation, ainsi qu'à la plateforme européenne de règlement en ligne des litiges.

À défaut d'accord amiable, le litige est porté devant [TRIBUNAL COMPÉTENT], sous réserve des règles impératives qui permettent à la consommatrice de saisir la juridiction de son domicile.

Fait électroniquement, le {{contrat.date}}.
$modele$, '2025-09-01', true, 'Version initiale (brouillon à faire valider par un juriste).', '2025-09-01T08:00:00Z')
on conflict (id) do nothing;

insert into public.contract_templates (id, kind, version, title, body_md, effective_from, is_active, notes, activated_at)
values ('0c0a0000-0000-4000-a000-000000000002', 'partner', 1, 'Contrat de partenariat (offres aux membres)', $modele$>> BROUILLON — à faire valider par un juriste. Ce texte est un point de départ rédigé pour l'application : il n'a aucune valeur juridique tant qu'il n'a pas été relu, complété et validé. Les mentions entre crochets sont à compléter par le club avant d'activer une nouvelle version.
>> Droit applicable : les passages marqués [MAROC] et [FRANCE] changent selon que l'entité qui encaisse est marocaine (loi 31-08 sur la protection du consommateur, loi 09-08 et CNDP, loi 53-05 sur l'échange électronique de données juridiques) ou française (Code de la consommation, RGPD et CNIL, articles 1366 et 1367 du Code civil). Garder une seule variante avant activation.
>> Contrat entre professionnels : pas de droit de rétractation en principe. [FRANCE] Exception : un professionnel employant cinq salariés au plus, pour un contrat hors de son activité principale conclu hors établissement (article L221-3 du Code de la consommation) ; à apprécier par le juriste.
>> À décider par la cliente : le partenariat est-il gratuit pour l'établissement (aujourd'hui : oui) ? Durée initiale et préavis.

# Contrat de partenariat — offres aux membres

Contrat n° {{contrat.numero}} · établi le {{contrat.date}} · modèle version {{modele.version}}

## Entre les soussignés

**Le club** : [RAISON SOCIALE], [FORME JURIDIQUE] au capital de [CAPITAL], dont le siège est situé [SIÈGE], immatriculée sous le numéro [ICE / SIREN], représentée par [REPRÉSENTANTE LÉGALE], ci-après « le Club » ou « {{club.nom}} ».

**Le partenaire** : l'établissement **{{etablissement.nom}}** ({{etablissement.categorie}}), situé {{etablissement.adresse}}, [FORME JURIDIQUE ET IMMATRICULATION DU PARTENAIRE], représenté par {{signataire.nom}} ({{signataire.email}}), ci-après « le Partenaire ».

## Article 1 — Objet

Le Partenaire propose aux membres du {{club.nom}} des avantages (réductions, attentions, accès privilégiés) publiés dans l'application du club. Le Club les fait connaître à ses membres, met à disposition du Partenaire un espace dédié (offres, validation des codes, statistiques, fiche de l'établissement) et le fait figurer sur la carte et dans le carnet.

## Article 2 — Durée

Le contrat prend effet le {{dates.debut}} pour une durée d'un (1) an. Il est ensuite reconduit tacitement par périodes d'un an, sauf dénonciation par l'une des parties avec un préavis de [30] jours.

## Article 3 — Conditions financières

Le partenariat est conclu à titre gratuit : aucune somme n'est due par le Partenaire au Club, et le Club ne perçoit aucune commission sur les ventes réalisées grâce aux offres. [Si un partenariat payant est prévu : PRIX ET MODALITÉS — à compléter.]

{{echeancier.detail}}

## Article 4 — Obligations du Partenaire

Le Partenaire s'engage à :

- honorer les offres publiées pendant toute leur période de validité, pour toute membre présentant un code valide ;
- rédiger des conditions claires (périmètre, exclusions, nombre d'utilisations) et les tenir à jour, en mettant en pause une offre qu'il ne peut plus honorer ;
- valider les codes au comptoir dans l'application, une seule fois, et ne pas en faire d'autre usage ;
- accueillir les membres sans discrimination, dans le respect de la réglementation applicable à son activité (hygiène, sécurité, assurances, autorisations) ;
- informer le Club de tout changement important (adresse, horaires, fermeture, changement de dirigeant).

## Article 5 — Obligations du Club

Le Club présente les offres du Partenaire à ses membres de façon loyale, met à sa disposition l'espace partenaire et ses statistiques, et le prévient avant toute modification importante du fonctionnement des offres.

## Article 6 — Règles de vie et modération

Les membres de l'équipe du Partenaire qui utilisent l'application respectent les règles de vie du club (respect, confidentialité, absence de démarchage abusif). Le Club peut retirer une offre ou une fiche contraire à ces règles ou à la loi, après en avoir informé le Partenaire, sauf urgence.

## Article 7 — Données personnelles et géolocalisation

Chaque partie est responsable des traitements qu'elle met en œuvre. Lors de la validation d'un code, le Partenaire ne voit que le prénom de la membre et l'offre utilisée ; il ne reçoit ni ses coordonnées ni sa position. Il s'interdit de constituer un fichier des membres ou de les solliciter à partir de ces informations.

La position de l'établissement (adresse professionnelle) est affichée sur la carte du club. La géolocalisation des membres n'est jamais communiquée au Partenaire.

[MAROC] Les parties respectent la loi n° 09-08 et les délibérations de la CNDP.
[FRANCE] Les parties respectent le RGPD ; si le Partenaire traitait des données pour le compte du Club, un accord de sous-traitance (article 28) serait conclu.

## Article 8 — Statistiques

Le Club fournit au Partenaire, dans son espace, des statistiques mensuelles propres à son établissement (vues de la fiche, clics de contact, codes générés et validés). Ces statistiques sont agrégées et ne permettent pas d'identifier les membres. Le Club peut utiliser des statistiques globales et anonymes de son réseau.

## Article 9 — Droit à l'image et usage des marques

Le Partenaire autorise le Club à utiliser son nom, son logo et les photos de son établissement qu'il fournit, dans l'application et dans la communication du club, pendant la durée du contrat. Le Partenaire peut indiquer « Partenaire du {{club.nom}} » selon la charte fournie par le Club ; toute autre utilisation de la marque {{club.nom}} requiert un accord écrit. Les photos de membres prises dans l'établissement ne sont publiées qu'avec le consentement des personnes concernées.

## Article 10 — Parrainage et Espace Business

Le Partenaire peut faire connaître le club à sa clientèle ; il ne perçoit pas de récompense de parrainage, sauf accord écrit. **Le Club ne prélève aucune commission sur les affaires conclues entre le Partenaire et les membres et n'y est pas partie** ; il n'est pas responsable de leur exécution.

## Article 11 — Responsabilité

Le Partenaire est seul responsable des produits et services qu'il fournit aux membres, de leur conformité et de leur prix. Il déclare être assuré pour son activité. Le Club, simple intermédiaire d'information, ne peut être tenu responsable d'un litige entre le Partenaire et une membre, ni des dommages indirects.

## Article 12 — Résiliation

Chaque partie peut résilier le contrat à l'échéance annuelle moyennant le préavis prévu à l'article 2, ou à tout moment en cas de manquement grave de l'autre partie non corrigé dans un délai de [15] jours après une mise en demeure. Les offres en cours sont alors retirées de l'application ; les codes déjà émis sont honorés jusqu'à leur date limite.

## Article 13 — Acceptation électronique et preuve

Le Partenaire accepte le présent contrat en cochant la case « J'ai lu et j'accepte » dans l'application. Le Club conserve, à titre de preuve, la date et l'heure de l'acceptation, l'adresse IP, le navigateur utilisé, la version du modèle et l'empreinte numérique (SHA-256) du document PDF accepté. Les parties reconnaissent à cette acceptation la même valeur qu'une signature manuscrite.

[MAROC] Conformément à la loi n° 53-05 relative à l'échange électronique de données juridiques.
[FRANCE] Conformément aux articles 1366 et 1367 du Code civil.

Une copie du contrat au format PDF est envoyée par e-mail après l'acceptation et reste disponible à tout moment dans l'espace « Mes contrats ».

>> Une signature électronique qualifiée ou avancée (Yousign, Docusign) peut remplacer la case à cocher sans changer le texte ; à décider avec le juriste selon le niveau de preuve souhaité.

## Article 14 — Droit applicable et litiges

Le présent contrat est régi par le droit [DROIT APPLICABLE : Maroc ou France]. Avant toute action, les parties recherchent une solution amiable : toute réclamation est adressée par écrit à [E-MAIL DE CONTACT DU CLUB], qui y répond sous [15] jours.

À défaut d'accord amiable dans un délai de trente (30) jours, le litige est porté devant [TRIBUNAL COMPÉTENT].
>> Entre professionnels, la clause attributive de juridiction est en principe valable (tribunal de commerce du siège du Club, par exemple) ; à confirmer par le juriste.

Fait électroniquement, le {{contrat.date}}.
$modele$, '2025-09-01', true, 'Version initiale (brouillon à faire valider par un juriste).', '2025-09-01T08:00:00Z')
on conflict (id) do nothing;

insert into public.contract_templates (id, kind, version, title, body_md, effective_from, is_active, notes, activated_at)
values ('0c0a0000-0000-4000-a000-000000000003', 'pro', 1, 'Contrat de référencement (carnet, abonnement mensuel)', $modele$>> BROUILLON — à faire valider par un juriste. Ce texte est un point de départ rédigé pour l'application : il n'a aucune valeur juridique tant qu'il n'a pas été relu, complété et validé. Les mentions entre crochets sont à compléter par le club avant d'activer une nouvelle version.
>> Droit applicable : les passages marqués [MAROC] et [FRANCE] changent selon que l'entité qui encaisse est marocaine (loi 31-08 sur la protection du consommateur, loi 09-08 et CNDP, loi 53-05 sur l'échange électronique de données juridiques) ou française (Code de la consommation, RGPD et CNIL, articles 1366 et 1367 du Code civil). Garder une seule variante avant activation.
>> Contrat entre professionnels : pas de droit de rétractation en principe. [FRANCE] Exception possible pour un professionnel de cinq salariés au plus (article L221-3 du Code de la consommation).
>> Professions réglementées (santé, droit, finance…) : vérifier les règles de publicité propres à chaque profession (codes de déontologie) avant de référencer.

# Contrat de référencement — carnet d'adresses du Nomad Club

Contrat n° {{contrat.numero}} · établi le {{contrat.date}} · modèle version {{modele.version}}

## Entre les soussignés

**Le club** : [RAISON SOCIALE], [FORME JURIDIQUE] au capital de [CAPITAL], dont le siège est situé [SIÈGE], immatriculée sous le numéro [ICE / SIREN], représentée par [REPRÉSENTANTE LÉGALE], ci-après « le Club » ou « {{club.nom}} ».

**La professionnelle** : **{{etablissement.nom}}** ({{etablissement.categorie}}), située {{etablissement.adresse}}, [FORME JURIDIQUE ET IMMATRICULATION DE LA PROFESSIONNELLE], représentée par {{signataire.nom}} ({{signataire.email}}), ci-après « la Professionnelle ».

## Article 1 — Objet

Le Club référence la Professionnelle dans le carnet d'adresses de son application, réservé aux membres, avec la formule **{{formule.nom}}** : {{formule.avantages}}. La Professionnelle dispose d'un espace pour gérer sa fiche, son abonnement et ses statistiques de visibilité. Le référencement ne suppose pas de proposer une réduction aux membres.

## Article 2 — Durée et renouvellement

L'abonnement prend effet le {{dates.debut}}. Il est conclu pour une durée d'un (1) mois, renouvelée tacitement de mois en mois tant qu'il n'est pas arrêté. La Professionnelle peut l'arrêter à tout moment depuis son espace : l'arrêt prend effet à la fin de la période mensuelle en cours, déjà payée.

## Article 3 — Prix et paiement

Grille tarifaire : [PRIX MENSUEL PRO — grille à confirmer : Essentiel, Visibilité, Vitrine]. Pour la formule choisie, le prix est de **{{montant.mensuel}} par mois** (devise : {{montant.devise}}), [HT / TTC — à préciser], payable d'avance :

{{echeancier.detail}}

Un changement de formule s'applique immédiatement et est facturé à l'échéance suivante. Le Club peut faire évoluer ses prix pour l'avenir en prévenant la Professionnelle au moins [30] jours à l'avance ; elle peut alors arrêter son abonnement sans frais.

## Article 4 — Retard de paiement

Si une échéance n'est pas réglée à sa date, la fiche est masquée du carnet jusqu'au paiement. Après quinze (15) jours de retard, l'abonnement est suspendu. Les sommes versées pour une période commencée restent acquises. [PÉNALITÉS DE RETARD ET INDEMNITÉ DE RECOUVREMENT : à préciser selon le droit applicable.]

## Article 5 — Obligations de la Professionnelle

La Professionnelle s'engage à :

- fournir des informations exactes et à jour (activité, coordonnées, horaires, photos dont elle détient les droits) ;
- détenir les diplômes, autorisations et assurances exigés pour son activité, et respecter les règles de sa profession, notamment en matière de publicité ;
- ne publier aucune allégation trompeuse ni contenu contraire à la loi ;
- accueillir les membres avec le même sérieux que sa clientèle, et honorer la réduction qu'elle a éventuellement annoncée.

## Article 6 — Modération des fiches

Le Club peut refuser, modifier ou retirer une fiche (ou un élément de fiche) contraire au présent contrat, aux règles de vie du club ou à la loi, après en avoir informé la Professionnelle, sauf urgence. Les membres de l'équipe de la Professionnelle qui utilisent l'application respectent les règles de vie du club.

## Article 7 — Statistiques

Le Club fournit chaque mois, dans l'espace de la Professionnelle, des statistiques de visibilité propres à sa fiche (vues, clics vers le téléphone, WhatsApp, le site, l'itinéraire). Elles sont agrégées et ne permettent pas d'identifier les membres. Le Club ne garantit aucun volume de visites ni de clientèle.

## Article 8 — Données personnelles et géolocalisation

Chaque partie est responsable des traitements qu'elle met en œuvre. L'adresse professionnelle et la position de l'établissement peuvent être affichées sur la carte du club ; la géolocalisation des membres n'est jamais communiquée à la Professionnelle. Les membres qui la contactent le font directement, par les moyens qu'elle a publiés.

[MAROC] Les parties respectent la loi n° 09-08 et les délibérations de la CNDP.
[FRANCE] Les parties respectent le RGPD.

## Article 9 — Droit à l'image et usage des marques

La Professionnelle autorise le Club à utiliser son nom, son logo et les photos qu'elle fournit, dans l'application et la communication du club, pendant la durée de l'abonnement. Elle peut indiquer « Référencée par le {{club.nom}} » selon la charte fournie ; toute autre utilisation de la marque requiert un accord écrit du Club.

## Article 10 — Parrainage et Espace Business

La Professionnelle peut faire connaître le club ; elle ne perçoit pas de récompense de parrainage, sauf accord écrit. **Le Club ne prélève aucune commission sur les prestations vendues aux membres et n'est pas partie aux contrats conclus avec elles** ; il n'est pas responsable de leur exécution ni de leur paiement.

## Article 11 — Responsabilité

Le référencement est un service d'information : il ne constitue ni une recommandation personnalisée ni une garantie des prestations. La Professionnelle est seule responsable de ses prestations envers les membres. La responsabilité du Club, tenu d'une obligation de moyens, est limitée au montant des trois derniers mois d'abonnement payés, sauf faute lourde ou dolosive.

## Article 12 — Résiliation

Outre l'arrêt mensuel prévu à l'article 2, chaque partie peut résilier le contrat en cas de manquement grave de l'autre partie non corrigé dans un délai de [8] jours après une mise en demeure. La fiche est alors retirée du carnet.

## Article 13 — Acceptation électronique et preuve

La Professionnelle accepte le présent contrat en cochant la case « J'ai lu et j'accepte » dans l'application. Le Club conserve, à titre de preuve, la date et l'heure de l'acceptation, l'adresse IP, le navigateur utilisé, la version du modèle et l'empreinte numérique (SHA-256) du document PDF accepté. Les parties reconnaissent à cette acceptation la même valeur qu'une signature manuscrite.

[MAROC] Conformément à la loi n° 53-05 relative à l'échange électronique de données juridiques.
[FRANCE] Conformément aux articles 1366 et 1367 du Code civil.

Une copie du contrat au format PDF est envoyée par e-mail après l'acceptation et reste disponible à tout moment dans l'espace « Mes contrats ».

>> Une signature électronique qualifiée ou avancée (Yousign, Docusign) peut remplacer la case à cocher sans changer le texte ; à décider avec le juriste selon le niveau de preuve souhaité.

## Article 14 — Droit applicable et litiges

Le présent contrat est régi par le droit [DROIT APPLICABLE : Maroc ou France]. Avant toute action, les parties recherchent une solution amiable : toute réclamation est adressée par écrit à [E-MAIL DE CONTACT DU CLUB], qui y répond sous [15] jours.

À défaut d'accord amiable dans un délai de trente (30) jours, le litige est porté devant [TRIBUNAL COMPÉTENT].
>> Entre professionnels, la clause attributive de juridiction est en principe valable (tribunal de commerce du siège du Club, par exemple) ; à confirmer par le juriste.

Fait électroniquement, le {{contrat.date}}.
$modele$, '2025-09-01', true, 'Version initiale (brouillon à faire valider par un juriste).', '2025-09-01T08:00:00Z')
on conflict (id) do nothing;
-- </modeles-initiaux>


-- ===================== 0011_emails.sql =====================
-- =====================================================================
-- 0011_emails.sql : journal des e-mails transactionnels (vague 2, chantier E-mails)
-- Dépend de 0001 (profiles), 0003 (has_role) et 0008 (admin_mfa_ok).
--
-- - email_log : un envoi = une ligne (destinataire, modèle, statut, identifiant fournisseur, erreur).
--   Écriture par le serveur uniquement (clé service) ; lecture réservée aux administratrices
--   (et en AAL2 quand la base exige la double authentification).
-- - Les données du modèle sont gardées pour « Renvoyer » ; elles sont effacées avec le compte
--   (anonymisation : adresse e-mail du profil remise à null) et purgées après 180 jours.
-- =====================================================================

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  to_email text not null check (char_length(to_email) between 3 and 320),
  template text not null check (template ~ '^[a-z_]{1,40}$'),
  subject text not null default '' check (char_length(subject) <= 300),
  status text not null check (status in ('sent', 'failed')),
  provider text not null check (provider ~ '^[a-z]{1,20}$'),
  provider_id text check (provider_id is null or char_length(provider_id) <= 200),
  error text check (error is null or char_length(error) <= 1000),
  data jsonb not null default '{}'::jsonb,
  attachments text[] not null default '{}',
  resent_from uuid references public.email_log (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_template_idx on public.email_log (template, created_at desc);
create index if not exists email_log_profile_idx on public.email_log (profile_id, template) where profile_id is not null;

alter table public.email_log enable row level security;

create policy email_log_admin_read on public.email_log for select using (public.has_role('admin'));
-- Lot 6 : quand la base exige la 2FA, une administratrice en AAL1 ne lit pas le journal des e-mails.
create policy email_log_admin_mfa on public.email_log as restrictive for select using (public.admin_mfa_ok());

-- Aucune écriture par les comptes : seul le serveur (service_role, qui contourne la RLS) journalise.
revoke all on public.email_log from anon;
revoke insert, update, delete, truncate on public.email_log from authenticated;
grant select on public.email_log to authenticated;

-- Compte anonymisé (adresse remise à null) : ses e-mails disparaissent du journal.
create or replace function public.email_log_forget_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.email is not null and new.email is null then
    delete from public.email_log where profile_id = new.id or lower(to_email) = lower(old.email);
  end if;
  return new;
end $$;
revoke execute on function public.email_log_forget_profile() from public, anon, authenticated;

drop trigger if exists profiles_email_log_forget on public.profiles;
create trigger profiles_email_log_forget after update of email on public.profiles
  for each row execute function public.email_log_forget_profile();

-- Purge des envois anciens (tâche planifiée, clé service uniquement). Renvoie le nombre de lignes supprimées.
create or replace function public.purge_email_log(p_days integer default 180) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_only'; end if;
  delete from public.email_log where created_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_email_log(integer) from public, anon, authenticated;
grant execute on function public.purge_email_log(integer) to service_role;


-- ===================== 0012_lancement.sql =====================
-- =====================================================================
-- Nomad Club : 0012_lancement.sql (vague 2, chantier « Inscription et lancement »)
-- Inscription réelle (fiche complète à la création du compte, CGU et confidentialité acceptées),
-- onboarding, candidatures d'adhésion (sur validation ou directe), invitations à usage unique
-- qui attribuent un rôle (modératrice, partenaire, pro).
-- Ne dépend que de 0001 à 0008. pgcrypto (digest, gen_random_bytes) : schéma « extensions » sur Supabase,
-- d'où search_path = public, extensions dans les fonctions qui s'en servent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Types de notifications et cibles du journal : contraintes « liste » étendues seulement si elles
--    existent encore (depuis 0007 ce sont des formats ^[a-z_]{1,40}$, qui acceptent déjà les nôtres).
-- ---------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in select * from (values ('notifications', 'type'), ('notification_prefs', 'type'), ('audit_log', 'target_type')) v(tbl, col) loop
    if exists (
      select 1 from pg_constraint con join pg_class rel on rel.oid = con.conrelid join pg_namespace ns on ns.oid = rel.relnamespace
       where ns.nspname = 'public' and rel.relname = t.tbl and con.contype = 'c'
         and pg_get_constraintdef(con.oid) ~ ('\m' || t.col || '\M') and pg_get_constraintdef(con.oid) ~ 'ANY|IN \('
    ) and to_regproc('public.nc_extend_check') is not null then
      perform public.nc_extend_check(t.tbl, t.col,
        case when t.col = 'type' then array['application_received', 'application_accepted', 'application_refused'] else array['application', 'invitation', 'settings'] end);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 1. Réglages (une seule ligne) : adhésion sur validation ou directe, version des CGU en vigueur
-- ---------------------------------------------------------------------
create table public.lancement_settings (
  id smallint primary key default 1 check (id = 1),
  membership_mode text not null default 'validation' check (membership_mode in ('validation', 'direct')),
  terms_version text not null default '2026-11-brouillon' check (length(terms_version) between 1 and 40),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.lancement_settings (id) values (1) on conflict do nothing;

alter table public.lancement_settings enable row level security;
-- lisible par toutes (la page des formules en dépend, même sans compte)
create policy lancement_settings_read on public.lancement_settings for select using (true);
create policy lancement_settings_admin on public.lancement_settings for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
revoke insert, delete on public.lancement_settings from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Inscription et onboarding (une ligne par compte)
-- ---------------------------------------------------------------------
create table public.member_onboarding (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  -- comment elle a connu le club (mêmes valeurs que crm_contacts.source)
  heard_from text check (heard_from in ('instagram', 'bouche_a_oreille', 'evenement', 'site', 'parrainage', 'partenaire', 'presse', 'linkedin', 'autre')),
  heard_from_detail text check (length(heard_from_detail) <= 200),
  -- choix fait à l'inscription : rester en compte gratuit ou demander l'adhésion
  signup_path text not null default 'free' check (signup_path in ('free', 'apply')),
  referral_code text check (referral_code ~ '^[A-Z0-9-]{3,24}$'),
  terms_version text,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  terms_ip text check (length(terms_ip) <= 64),
  steps_done text[] not null default '{}' check (steps_done <@ array['profile', 'privacy', 'notifications', 'install']::text[]),
  completed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_onboarding_terms check ((terms_accepted_at is null) = (terms_version is null))
);

alter table public.member_onboarding enable row level security;
-- lecture : soi-même et l'admin ; aucune écriture directe (fonctions ci-dessous)
create policy member_onboarding_own_read on public.member_onboarding for select to authenticated
  using (profile_id = auth.uid() or public.has_role('admin'));
revoke insert, update, delete on public.member_onboarding from anon, authenticated;

-- Création du compte (lien magique) : profil complet depuis les métadonnées de l'inscription.
-- Les métadonnées viennent du navigateur : tout est nettoyé et borné, rien ne donne de droit.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  clean text;
  v_first text := left(nullif(trim(m ->> 'first_name'), ''), 80);
  v_heard text := m ->> 'heard_from';
  v_terms boolean := coalesce(m ->> 'terms_accepted', '') = 'true';
  v_version text;
begin
  insert into public.profiles (id, email, first_name, last_name, whatsapp, country)
  values (
    new.id,
    new.email,
    coalesce(v_first, initcap(split_part(coalesce(new.email, ''), '@', 1))),
    coalesce(left(nullif(trim(m ->> 'last_name'), ''), 80), ''),
    left(nullif(regexp_replace(coalesce(m ->> 'whatsapp', ''), '[^0-9+ ]', '', 'g'), ''), 24),
    left(nullif(trim(m ->> 'country'), ''), 60)
  )
  on conflict (id) do nothing;

  select terms_version into v_version from public.lancement_settings where id = 1;
  clean := upper(regexp_replace(coalesce(m ->> 'referral_code', ''), '[^A-Za-z0-9-]', '', 'g'));
  insert into public.member_onboarding (profile_id, heard_from, heard_from_detail, signup_path, referral_code, terms_version, terms_accepted_at, privacy_accepted_at)
  values (
    new.id,
    case when v_heard in ('instagram', 'bouche_a_oreille', 'evenement', 'site', 'parrainage', 'partenaire', 'presse', 'linkedin', 'autre') then v_heard end,
    left(nullif(trim(m ->> 'heard_from_detail'), ''), 200),
    case when m ->> 'signup_path' = 'apply' then 'apply' else 'free' end,
    case when clean ~ '^[A-Z0-9-]{3,24}$' then clean end,
    case when v_terms then coalesce(v_version, 'inconnue') end,
    case when v_terms then now() end,
    case when v_terms then now() end
  )
  on conflict (profile_id) do nothing;

  -- fiche CRM (0007) : source déclarée à l'inscription
  if v_heard in ('instagram', 'bouche_a_oreille', 'evenement', 'site', 'parrainage', 'partenaire', 'presse', 'linkedin', 'autre') and to_regclass('public.crm_contacts') is not null then
    execute 'update public.crm_contacts set source = $1 where profile_id = $2 and source = ''appli''' using v_heard, new.id;
  end if;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- comptes déjà présents : une ligne d'onboarding (considéré comme fait : ils utilisent déjà l'appli)
insert into public.member_onboarding (profile_id, completed_at, created_at)
select id, now(), created_at from public.profiles
on conflict (profile_id) do nothing;

-- État de l'inscription de la personne connectée (créé au besoin : compte venu d'ailleurs).
create or replace function public.my_onboarding() returns public.member_onboarding
language plpgsql security definer set search_path = public as $$
declare
  r public.member_onboarding;
begin
  if auth.uid() is null then raise exception 'login'; end if;
  insert into public.member_onboarding (profile_id) values (auth.uid()) on conflict (profile_id) do nothing;
  select * into r from public.member_onboarding where profile_id = auth.uid();
  return r;
end $$;

-- Acceptation des CGU et de la politique de confidentialité (version en vigueur, horodatée, IP).
create or replace function public.accept_terms(p_ip text default null) returns public.member_onboarding
language plpgsql security definer set search_path = public as $$
declare
  r public.member_onboarding;
  v_version text;
begin
  if auth.uid() is null then raise exception 'login'; end if;
  perform public.my_onboarding();
  select terms_version into v_version from public.lancement_settings where id = 1;
  update public.member_onboarding
     set terms_version = v_version, terms_accepted_at = now(), privacy_accepted_at = now(), terms_ip = left(p_ip, 64), updated_at = now()
   where profile_id = auth.uid()
  returning * into r;
  insert into public.audit_log (actor_id, action, target_type, target_id, summary, details)
  values (auth.uid(), 'consent.update', 'profile', auth.uid(), 'CGU et politique de confidentialité acceptées', jsonb_build_object('version', v_version));
  return r;
end $$;

-- Étapes de l'onboarding (fiche, confidentialité, notifications, installation) : faites, sautées, terminées.
create or replace function public.onboarding_progress(p_step text default null, p_finish text default null) returns public.member_onboarding
language plpgsql security definer set search_path = public as $$
declare
  r public.member_onboarding;
begin
  if auth.uid() is null then raise exception 'login'; end if;
  if p_step is not null and p_step not in ('profile', 'privacy', 'notifications', 'install') then raise exception 'invalid_step'; end if;
  if p_finish is not null and p_finish not in ('completed', 'skipped', 'reset') then raise exception 'invalid_finish'; end if;
  perform public.my_onboarding();
  update public.member_onboarding
     set steps_done = case when p_step is null or p_step = any(steps_done) then steps_done else steps_done || p_step end,
         completed_at = case p_finish when 'completed' then now() when 'reset' then null else completed_at end,
         skipped_at = case p_finish when 'skipped' then now() when 'reset' then null else skipped_at end,
         updated_at = now()
   where profile_id = auth.uid()
  returning * into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- 3. Candidatures d'adhésion
-- ---------------------------------------------------------------------
create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  job text not null check (length(job) between 2 and 120),
  company text check (length(company) <= 120),
  marrakech_since text not null check (length(marrakech_since) between 1 and 40),
  motivation text not null check (length(motivation) between 20 and 2000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'refused', 'withdrawn')),
  decision_message text check (length(decision_message) <= 1000),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint membership_applications_decided check ((status in ('pending', 'withdrawn')) or decided_at is not null)
);
create unique index membership_applications_one_pending on public.membership_applications (profile_id) where status = 'pending';
create index membership_applications_status_idx on public.membership_applications (status, created_at);

alter table public.membership_applications enable row level security;
create policy membership_applications_own_read on public.membership_applications for select to authenticated
  using (profile_id = auth.uid() or public.has_role('admin'));
revoke insert, update, delete on public.membership_applications from anon, authenticated;

-- CRM (0007) : une ligne d'historique sur la fiche du compte, si la table existe.
create or replace function public.lancement_crm_note(p_profile uuid, p_body text, p_author uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.crm_contacts') is null then return; end if;
  execute 'insert into public.crm_activities (contact_id, type, body, author_id)
           select id, ''system'', $2, $3 from public.crm_contacts where profile_id = $1'
    using p_profile, left(p_body, 4000), p_author;
end $$;
revoke all on function public.lancement_crm_note(uuid, text, uuid) from public, anon, authenticated;

-- Déposer sa candidature (compte connecté, pas déjà adhérente, une seule en attente).
create or replace function public.submit_membership_application(p_job text, p_company text, p_marrakech_since text, p_motivation text)
returns public.membership_applications
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  r public.membership_applications;
  v_name text;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'login'; end if;
  if me.plan <> 'free' and (me.plan_ends_at is null or me.plan_ends_at >= current_date) then raise exception 'already_member'; end if;
  if exists (select 1 from public.membership_applications where profile_id = me.id and status = 'pending') then raise exception 'already_pending'; end if;
  insert into public.membership_applications (profile_id, job, company, marrakech_since, motivation)
  values (me.id, trim(p_job), nullif(trim(coalesce(p_company, '')), ''), trim(p_marrakech_since), trim(p_motivation))
  returning * into r;
  -- la fiche profil reprend le métier et l'arrivée à Marrakech s'ils manquaient
  perform set_config('nc.trusted', 'on', true);
  update public.profiles set job = coalesce(nullif(job, ''), r.job), marrakech_since = coalesce(nullif(marrakech_since, ''), r.marrakech_since) where id = me.id;
  perform set_config('nc.trusted', 'off', true);
  v_name := coalesce(nullif(trim(me.first_name || ' ' || me.last_name), ''), 'Une inscrite');
  insert into public.notifications (recipient_id, type, title, body, link)
  select ur.profile_id, 'application_received', 'Nouvelle candidature', left(v_name || ' · ' || r.job, 600), '/fondatrices/candidatures'
    from public.user_roles ur where ur.role = 'admin';
  insert into public.audit_log (actor_id, action, target_type, target_id, summary, details)
  values (me.id, 'application.submit', 'application', r.id, left('Candidature de ' || v_name, 300), jsonb_build_object('job', r.job));
  perform public.lancement_crm_note(me.id, 'Candidature d’adhésion déposée : ' || r.job || coalesce(' · ' || r.company, ''), me.id);
  return r;
end $$;

-- Retirer sa candidature en attente.
create or replace function public.withdraw_membership_application() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login'; end if;
  update public.membership_applications set status = 'withdrawn' where profile_id = auth.uid() and status = 'pending';
  return found;
end $$;

-- Accepter ou refuser (administratrices). Journalisé, notifié, noté au CRM.
create or replace function public.decide_membership_application(p_application uuid, p_accept boolean, p_message text default null)
returns public.membership_applications
language plpgsql security definer set search_path = public as $$
declare
  r public.membership_applications;
  v_name text;
  v_msg text := nullif(trim(coalesce(p_message, '')), '');
begin
  if not public.has_role('admin') then raise exception 'admin_only'; end if;
  if not p_accept and v_msg is null then raise exception 'message_required'; end if;
  update public.membership_applications
     set status = case when p_accept then 'accepted' else 'refused' end, decision_message = left(v_msg, 1000), decided_by = auth.uid(), decided_at = now()
   where id = p_application and status = 'pending'
  returning * into r;
  if not found then raise exception 'not_pending'; end if;
  select coalesce(nullif(trim(first_name || ' ' || last_name), ''), 'Une inscrite') into v_name from public.profiles where id = r.profile_id;
  insert into public.notifications (recipient_id, type, title, body, link)
  values (
    r.profile_id,
    case when p_accept then 'application_accepted' else 'application_refused' end,
    case when p_accept then 'Ta candidature est acceptée' else 'Réponse à ta candidature' end,
    left(case when p_accept then 'Bienvenue au Nomad Club ! Choisis ta formule pour activer ton adhésion.' || coalesce(' ' || v_msg, '') else v_msg end, 600),
    case when p_accept then '/formules' else '/candidature' end
  );
  insert into public.audit_log (actor_id, action, target_type, target_id, summary, details)
  values (auth.uid(), case when p_accept then 'application.accept' else 'application.refuse' end, 'application', r.id,
          left((case when p_accept then 'Candidature acceptée · ' else 'Candidature refusée · ' end) || v_name, 300),
          jsonb_build_object('profileId', r.profile_id, 'message', v_msg));
  perform public.lancement_crm_note(r.profile_id, (case when p_accept then 'Candidature acceptée' else 'Candidature refusée' end) || coalesce(' : ' || v_msg, ''), auth.uid());
  return r;
end $$;

-- La personne connectée peut-elle payer une première adhésion ?
-- Oui si l'adhésion est directe, si sa candidature est acceptée, si elle est (ou a été) membre, ou admin.
create or replace function public.can_join_membership() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    (select membership_mode from public.lancement_settings where id = 1) = 'direct'
    or public.has_role('admin')
    or exists (select 1 from public.membership_applications where profile_id = auth.uid() and status = 'accepted')
    or exists (select 1 from public.memberships where profile_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- 4. Invitations à usage unique qui attribuent un rôle (modératrice, partenaire, pro)
-- ---------------------------------------------------------------------
create table public.role_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  role text not null check (role in ('moderator', 'partner', 'pro')),
  organization_id uuid references public.organizations (id) on delete set null,
  note text check (length(note) <= 300),
  token_hash text not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz
);
create index role_invitations_email_idx on public.role_invitations (email);

alter table public.role_invitations enable row level security;
create policy role_invitations_admin_read on public.role_invitations for select to authenticated using (public.has_role('admin'));
revoke insert, update, delete on public.role_invitations from anon, authenticated;

-- Créer une invitation (admin) : renvoie le jeton en clair UNE fois (seule son empreinte est gardée).
create or replace function public.create_role_invitation(p_email text, p_role text, p_organization uuid default null, p_note text default null)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
  r public.role_invitations;
begin
  if not public.has_role('admin') then raise exception 'admin_only'; end if;
  if p_role not in ('moderator', 'partner', 'pro') then raise exception 'invalid_role'; end if;
  if p_organization is not null and not exists (select 1 from public.organizations where id = p_organization) then raise exception 'organization_not_found'; end if;
  -- une seule invitation ouverte par adresse et par rôle : la précédente est révoquée
  update public.role_invitations set revoked_at = now()
   where email = lower(trim(p_email)) and role = p_role and accepted_at is null and revoked_at is null;
  insert into public.role_invitations (email, role, organization_id, note, token_hash, invited_by)
  values (lower(trim(p_email)), p_role, p_organization, nullif(trim(coalesce(p_note, '')), ''), encode(digest(v_token, 'sha256'), 'hex'), auth.uid())
  returning * into r;
  insert into public.audit_log (actor_id, action, target_type, target_id, summary, details)
  values (auth.uid(), 'invitation.create', 'invitation', r.id, left('Invitation ' || p_role || ' · ' || r.email, 300), jsonb_build_object('role', p_role, 'email', r.email, 'organizationId', p_organization));
  return json_build_object('id', r.id, 'token', v_token, 'expires_at', r.expires_at);
end $$;

create or replace function public.revoke_role_invitation(p_invitation uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin_only'; end if;
  update public.role_invitations set revoked_at = now() where id = p_invitation and accepted_at is null and revoked_at is null;
  if found then
    insert into public.audit_log (actor_id, action, target_type, target_id, summary)
    values (auth.uid(), 'invitation.revoke', 'invitation', p_invitation, 'Invitation révoquée');
  end if;
  return found;
end $$;

-- Aperçu d'une invitation (page d'arrivée du lien, même sans compte) : rien de plus que le nécessaire.
create or replace function public.role_invitation_preview(p_token text) returns json
language sql stable security definer set search_path = public, extensions as $$
  select json_build_object(
    'role', i.role,
    'email_hint', left(i.email, 2) || '•••@' || split_part(i.email, '@', 2),
    'organization', o.name,
    'state', case when i.accepted_at is not null then 'used' when i.revoked_at is not null then 'revoked' when i.expires_at < now() then 'expired' else 'open' end
  )
  from public.role_invitations i left join public.organizations o on o.id = i.organization_id
  where i.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Accepter (compte connecté avec l'adresse invitée) : rôle attribué, établissement rattaché, lien consommé.
create or replace function public.accept_role_invitation(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  i public.role_invitations;
  v_email text;
begin
  if auth.uid() is null then raise exception 'login'; end if;
  select * into i from public.role_invitations where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found then raise exception 'invitation_not_found'; end if;
  if i.accepted_at is not null then raise exception 'invitation_used'; end if;
  if i.revoked_at is not null then raise exception 'invitation_revoked'; end if;
  if i.expires_at < now() then raise exception 'invitation_expired'; end if;
  select lower(coalesce(u.email, p.email)) into v_email from public.profiles p left join auth.users u on u.id = p.id where p.id = auth.uid();
  if v_email is distinct from i.email then raise exception 'invitation_email_mismatch'; end if;
  insert into public.user_roles (profile_id, role, granted_by) values (auth.uid(), i.role, i.invited_by) on conflict do nothing;
  if i.organization_id is not null then
    insert into public.organization_members (organization_id, profile_id, role) values (i.organization_id, auth.uid(), 'owner')
    on conflict do nothing;
  end if;
  update public.role_invitations set accepted_at = now(), accepted_by = auth.uid() where id = i.id;
  insert into public.notifications (recipient_id, type, title, body, link)
  values (auth.uid(), 'role_changed', 'Un nouvel espace s’ouvre',
          case i.role when 'moderator' then 'Tu es modératrice du Nomad Club.' when 'partner' then 'Ton espace Partenaire est ouvert.' else 'Ton espace Pro est ouvert.' end,
          case i.role when 'moderator' then '/espace/moderation' when 'partner' then '/partenaire' else '/pro' end);
  insert into public.audit_log (actor_id, action, target_type, target_id, summary, details)
  values (auth.uid(), 'invitation.accept', 'invitation', i.id, left('Invitation acceptée · ' || i.role || ' · ' || i.email, 300), jsonb_build_object('role', i.role, 'invitedBy', i.invited_by));
  return json_build_object('role', i.role, 'organization_id', i.organization_id);
end $$;

-- ---------------------------------------------------------------------
-- 5. Droits d'exécution
-- ---------------------------------------------------------------------
revoke all on function public.my_onboarding(), public.accept_terms(text), public.onboarding_progress(text, text),
  public.submit_membership_application(text, text, text, text), public.withdraw_membership_application(),
  public.decide_membership_application(uuid, boolean, text), public.can_join_membership(),
  public.create_role_invitation(text, text, uuid, text), public.revoke_role_invitation(uuid),
  public.role_invitation_preview(text), public.accept_role_invitation(text) from public, anon;
grant execute on function public.my_onboarding(), public.accept_terms(text), public.onboarding_progress(text, text),
  public.submit_membership_application(text, text, text, text), public.withdraw_membership_application(),
  public.decide_membership_application(uuid, boolean, text), public.can_join_membership(),
  public.create_role_invitation(text, text, uuid, text), public.revoke_role_invitation(uuid),
  public.accept_role_invitation(text) to authenticated;
grant execute on function public.role_invitation_preview(text) to anon, authenticated;

