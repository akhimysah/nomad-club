-- Nomad Club : réparation des accents dans les fonctions de la base.
-- Recrée, depuis supabase/migrations (UTF-8), la dernière version de chaque fonction qui contient du texte accentué.
-- Sans danger à relancer. À coller dans Supabase > SQL Editor, puis Run.
begin;

-- 0001_init.sql
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

-- 0003_socle.sql
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

-- 0003_socle.sql
create or replace function public.protect_organization() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or public.has_role('admin') then return new; end if;
  if new.status is distinct from old.status or new.kinds is distinct from old.kinds or new.slug is distinct from old.slug then
    raise exception 'Modification réservée aux fondatrices.';
  end if;
  return new;
end $$;

-- 0004_communaute.sql
create or replace function public.nc_fold(p text) returns text
language sql immutable set search_path = public as $$
  select translate(lower(coalesce(p, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ’', 'aaaaaaceeeeiiiinooooouuuuyy''');
$$;

-- 0004_communaute.sql
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

-- 0004_communaute.sql
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

-- 0004_communaute.sql
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

-- 0004_communaute.sql
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

-- 0004_communaute.sql
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

-- 0004_communaute.sql
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

-- 0004_communaute.sql
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

-- 0005_partenaires.sql
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

-- 0005_partenaires.sql
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

-- 0005_partenaires.sql
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

-- 0006_engagement.sql
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

-- 0006_engagement.sql
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

-- 0006_engagement.sql
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

-- 0006_engagement.sql
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

-- 0007_crm.sql
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

-- 0008_securite.sql
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

-- 0008_securite.sql
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

-- 0008_securite.sql
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

-- 0010_contrats.sql
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

-- 0010_contrats.sql
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

-- 0010_contrats.sql
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

-- 0010_contrats.sql
create or replace function public.contract_acceptance_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Une preuve d''acceptation ne peut être ni modifiée ni supprimée.';
end $$;

-- 0010_contrats.sql
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

-- 0012_lancement.sql
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

-- 0012_lancement.sql
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

-- 0012_lancement.sql
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

-- 0012_lancement.sql
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

-- 0012_lancement.sql
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

-- 0012_lancement.sql
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

-- 0012_lancement.sql
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

commit;
