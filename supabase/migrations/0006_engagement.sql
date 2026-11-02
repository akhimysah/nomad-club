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
