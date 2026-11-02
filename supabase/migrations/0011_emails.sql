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
