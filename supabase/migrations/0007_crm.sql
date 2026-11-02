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
