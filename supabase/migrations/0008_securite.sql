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
