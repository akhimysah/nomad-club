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
