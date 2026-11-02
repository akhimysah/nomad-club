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
