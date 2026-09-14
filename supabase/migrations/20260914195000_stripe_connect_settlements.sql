-- Stripe Connect settlement ledger for the EnjoyHub marketplace.
--
-- Customer charges stay on the platform account. After the booked service ends,
-- EnjoyHub transfers the organizer share to the connected Stripe account. The
-- connected account uses a manual payout schedule, so a bank payout only starts
-- when an authorized organizer requests it from EnjoyHub.

begin;

alter table public.organizations
  add column if not exists platform_fee_bps integer not null default 1000
    check (platform_fee_bps between 0 and 5000);

create table if not exists public.organization_payment_accounts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_account_id text not null unique check (char_length(provider_account_id) >= 8),
  details_submitted boolean not null default false,
  transfers_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  payout_schedule_manual boolean not null default false,
  disabled_reason text,
  requirements_currently_due text[] not null default '{}',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_charge_id text not null unique,
  provider_transfer_id text unique,
  transfer_group text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  gross_amount_minor bigint not null check (gross_amount_minor > 0),
  platform_fee_bps integer not null check (platform_fee_bps between 0 and 5000),
  platform_fee_amount_minor bigint not null check (platform_fee_amount_minor >= 0),
  organizer_amount_minor bigint not null check (organizer_amount_minor >= 0),
  service_ends_at timestamptz not null,
  eligible_at timestamptz not null,
  status text not null default 'pending_service' check (
    status in ('pending_service','transferred','payout_pending','paid_out','refunded','requires_review')
  ),
  transferred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gross_amount_minor = platform_fee_amount_minor + organizer_amount_minor),
  check (eligible_at >= service_ends_at),
  check (
    (
      status in ('transferred','payout_pending','paid_out')
      and provider_transfer_id is not null
      and transferred_at is not null
    )
    or status in ('pending_service','refunded','requires_review')
  )
);

create index if not exists marketplace_settlements_org_status_idx
  on public.marketplace_settlements(organization_id, status, eligible_at);
create index if not exists marketplace_settlements_release_idx
  on public.marketplace_settlements(eligible_at)
  where status = 'pending_service';

create table if not exists public.marketplace_payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_payout_id text not null unique,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_payouts_org_created_idx
  on public.marketplace_payouts(organization_id, created_at desc);

create table if not exists public.marketplace_payout_items (
  payout_id uuid not null references public.marketplace_payouts(id) on delete restrict,
  settlement_id uuid not null unique references public.marketplace_settlements(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now(),
  primary key (payout_id, settlement_id)
);

create trigger marketplace_organization_payment_accounts_updated_at
before update on public.organization_payment_accounts
for each row execute function public.ticketing_set_updated_at();

create trigger marketplace_settlements_updated_at
before update on public.marketplace_settlements
for each row execute function public.ticketing_set_updated_at();

create trigger marketplace_payouts_updated_at
before update on public.marketplace_payouts
for each row execute function public.ticketing_set_updated_at();

alter table public.organization_payment_accounts enable row level security;
alter table public.marketplace_settlements enable row level security;
alter table public.marketplace_payouts enable row level security;
alter table public.marketplace_payout_items enable row level security;

create policy organization_payment_accounts_select_finance_admins
on public.organization_payment_accounts for select to authenticated
using (
  public.ticketing_is_org_member(
    organization_id,
    array['owner','admin']::public.ticketing_member_role[]
  )
);

create policy marketplace_settlements_select_org_sales
on public.marketplace_settlements for select to authenticated
using (
  public.ticketing_is_org_member(
    organization_id,
    array['owner','admin','manager','viewer']::public.ticketing_member_role[]
  )
);

create policy marketplace_payouts_select_org_sales
on public.marketplace_payouts for select to authenticated
using (
  public.ticketing_is_org_member(
    organization_id,
    array['owner','admin','manager','viewer']::public.ticketing_member_role[]
  )
);

create policy marketplace_payout_items_select_org_sales
on public.marketplace_payout_items for select to authenticated
using (
  exists (
    select 1
    from public.marketplace_payouts payout
    where payout.id = marketplace_payout_items.payout_id
      and public.ticketing_is_org_member(
        payout.organization_id,
        array['owner','admin','manager','viewer']::public.ticketing_member_role[]
      )
  )
);

revoke all privileges on table
  public.organization_payment_accounts,
  public.marketplace_settlements,
  public.marketplace_payouts,
  public.marketplace_payout_items
from public, anon, authenticated;

grant select on public.organization_payment_accounts,
  public.marketplace_settlements,
  public.marketplace_payouts,
  public.marketplace_payout_items
to authenticated;

grant all privileges on public.organization_payment_accounts,
  public.marketplace_settlements,
  public.marketplace_payouts,
  public.marketplace_payout_items
to service_role;

comment on column public.organizations.platform_fee_bps is
  'EnjoyHub marketplace commission snapshot source. 1000 = 10.00%.';
comment on table public.marketplace_settlements is
  'One immutable commercial split per paid order; organizer funds become transferable only after service_ends_at.';
comment on table public.marketplace_payouts is
  'Organizer-requested bank payouts created on the connected Stripe account.';

commit;
