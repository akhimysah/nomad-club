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
