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
