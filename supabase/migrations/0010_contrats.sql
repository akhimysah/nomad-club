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
