-- =============================================================
-- Conversational Back-Office Agent — Phase 3 schema
-- Run top-to-bottom in the Supabase SQL editor.
--
-- SECURITY MODEL — read this first:
--   * The DASHBOARD (Next.js) talks to Supabase as the logged-in user
--     (anon/authenticated key). RLS below is what protects it.
--   * The BOT BACKEND talks to Supabase with the SERVICE ROLE key,
--     which BYPASSES RLS entirely. So the bot MUST scope every query
--     by business_id in code, and the service key must NEVER reach
--     the client. RLS is your safety net for the dashboard; disciplined
--     code is your safety net for the bot.
-- =============================================================

create extension if not exists pgcrypto;   -- for gen_random_uuid()

-- ---------- enums ----------
create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');
create type member_role    as enum ('owner', 'member');
create type payment_method as enum ('transfer', 'cash', 'card', 'other');

-- =============================================================
-- TABLES
-- =============================================================

-- A business is the tenant. Everything else hangs off business_id.
create table public.businesses (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  currency            text not null default 'GBP',
  logo_url            text,
  address             text,
  bank_name           text,
  bank_account_name   text,
  bank_account_number text,            -- sensitive: see encryption note at bottom
  invoice_seq         bigint not null default 0,   -- per-business invoice counter
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Optional app profile mirroring auth.users (handy for names on the dashboard).
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- Membership table: the anchor for ALL multi-tenant RLS.
-- One row per (business, user). Add members later for teams.
create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        member_role not null default 'owner',
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);

-- Customers the business invoices.
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  address     text,
  created_at  timestamptz not null default now()
);

-- Invoices. Totals are computed by YOUR code, not the LLM.
create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  client_id      uuid references public.clients(id) on delete set null,
  client_name    text not null,                 -- snapshot, in case client is edited/deleted
  invoice_number text not null,                 -- e.g. INV-0001, unique per business
  status         invoice_status not null default 'draft',
  currency       text not null default 'GBP',
  subtotal       numeric(14,2) not null default 0 check (subtotal >= 0),
  tax            numeric(14,2) not null default 0 check (tax >= 0),
  total          numeric(14,2) not null default 0 check (total >= 0),
  issue_date     date not null default current_date,
  due_date       date,
  notes          text,
  pdf_path       text,                          -- storage path: {business_id}/{invoice_id}.pdf
  created_by     uuid references auth.users(id),-- null when created by the bot
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (business_id, invoice_number)
);

-- Line items. The "₦250,000 consulting services" case is a single row here.
create table public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity    numeric(12,2) not null default 1 check (quantity > 0),
  unit_price  numeric(14,2) not null check (unit_price >= 0),
  amount      numeric(14,2) not null check (amount >= 0)
);

-- Payments recorded against invoices.
create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id  uuid references public.invoices(id) on delete set null,
  amount      numeric(14,2) not null check (amount > 0),
  method      payment_method not null default 'transfer',
  reference   text,
  paid_at     timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- Links a Telegram chat to a business + user. The bot looks up the
-- business by telegram_user_id on every incoming message.
create table public.telegram_links (
  telegram_user_id bigint primary key,
  business_id      uuid references public.businesses(id) on delete cascade,
  user_id          uuid references auth.users(id) on delete cascade,
  link_code        text,                 -- one-time code shown in dashboard during onboarding
  linked_at        timestamptz,
  created_at       timestamptz not null default now()
);

-- Append-only audit trail. Every create/modify of financial data lands here.
create table public.audit_log (
  id          bigint generated always as identity primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  actor       text not null,            -- a user_id, or 'bot'
  action      text not null,            -- e.g. 'invoice.created', 'payment.recorded'
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- indexes ----------
create index on public.business_members (user_id);
create index on public.clients (business_id);
create index on public.invoices (business_id, status);
create index on public.invoices (business_id, issue_date);
create index on public.invoice_items (invoice_id);
create index on public.payments (business_id);
create index on public.payments (invoice_id);
create index on public.audit_log (business_id, created_at);

-- =============================================================
-- HELPERS
-- =============================================================

-- SECURITY DEFINER so it can read business_members without tripping
-- that table's own RLS (avoids the classic recursive-policy error).
create or replace function public.is_business_member(b_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = b_id and m.user_id = auth.uid()
  );
$$;

-- Atomic, race-safe per-business invoice number. The single UPDATE
-- locks the business row, so two concurrent invoices can't collide.
create or replace function public.next_invoice_number(b_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  update public.businesses
     set invoice_seq = invoice_seq + 1
   where id = b_id
  returning invoice_seq into n;
  return 'INV-' || lpad(n::text, 4, '0');
end;
$$;

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_businesses_updated before update on public.businesses
  for each row execute function public.set_updated_at();
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function public.set_updated_at();

-- =============================================================
-- ROW-LEVEL SECURITY
-- Every tenant table: a user may touch a row only if they belong to
-- that row's business. (service_role bypasses all of this — by design.)
-- =============================================================

alter table public.businesses        enable row level security;
alter table public.profiles           enable row level security;
alter table public.business_members   enable row level security;
alter table public.clients            enable row level security;
alter table public.invoices           enable row level security;
alter table public.invoice_items      enable row level security;
alter table public.payments           enable row level security;
alter table public.telegram_links     enable row level security;
alter table public.audit_log          enable row level security;

-- profiles: a user sees and edits only their own row
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- business_members: a user sees only their own memberships
-- (kept simple to avoid recursion; inserts happen via service role at onboarding)
create policy "see own memberships" on public.business_members
  for select using (user_id = auth.uid());

-- businesses: members can read; members can update their business
create policy "members read business" on public.businesses
  for select using (public.is_business_member(id));
create policy "members update business" on public.businesses
  for update using (public.is_business_member(id))
  with check (public.is_business_member(id));

-- clients
create policy "members rw clients" on public.clients
  for all using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- invoices
create policy "members rw invoices" on public.invoices
  for all using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- invoice_items: gate via the parent invoice's business
create policy "members rw invoice_items" on public.invoice_items
  for all using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and public.is_business_member(i.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and public.is_business_member(i.business_id)
    )
  );

-- payments
create policy "members rw payments" on public.payments
  for all using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- telegram_links: a user sees only their own link
create policy "own telegram link" on public.telegram_links
  for select using (user_id = auth.uid());

-- audit_log: members may read their business's log; no client writes
-- (the bot/server writes audit rows via the service role)
create policy "members read audit" on public.audit_log
  for select using (public.is_business_member(business_id));

-- =============================================================
-- STORAGE — private bucket for invoice PDFs
-- Path convention: {business_id}/{invoice_id}.pdf
-- =============================================================

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- Members can read PDFs whose first path folder is their business_id
create policy "read business invoice pdfs" on storage.objects
  for select using (
    bucket_id = 'invoices'
    and public.is_business_member( ((storage.foldername(name))[1])::uuid )
  );

-- (The bot uploads PDFs with the service role, so no INSERT policy is
--  required for it. Add one here later if the dashboard needs to upload.)

-- =============================================================
-- EXPENSES — Phase 8 stretch: photograph a receipt, extract & record it
-- =============================================================

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  vendor        text not null,
  amount        numeric(14,2) not null check (amount > 0),
  currency      text not null default 'GBP',
  category      text,
  description   text,
  expense_date  date not null default current_date,
  receipt_path  text,                 -- storage path: {business_id}/{expense_id}.<ext>
  created_by    uuid references auth.users(id),  -- null when created by the bot
  created_at    timestamptz not null default now()
);

create index on public.expenses (business_id, expense_date);

alter table public.expenses enable row level security;

create policy "members rw expenses" on public.expenses
  for all using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- ---------- storage — private bucket for receipt images ----------
-- Path convention: {business_id}/{expense_id}.<ext>

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "read business receipts" on storage.objects
  for select using (
    bucket_id = 'receipts'
    and public.is_business_member( ((storage.foldername(name))[1])::uuid )
  );

-- =============================================================
-- VAT — Phase 8 stretch: per-business default tax rate, applied
-- deterministically by code (never by the LLM) on invoice creation
-- =============================================================

alter table public.businesses
  add column if not exists vat_rate numeric(5,2) not null default 0
    check (vat_rate >= 0 and vat_rate <= 100);

-- =============================================================
-- Connect codes — security hardening: short-lived, crypto-random
-- one-time codes for linking Telegram/WhatsApp to a business
-- (the live database already has these; recorded here so
-- schema.sql no longer drifts from it)
-- =============================================================

alter table public.businesses
  add column if not exists connect_code text,
  add column if not exists connect_code_expires_at timestamptz;

-- =============================================================
-- Conversation state — durable storage for in-flight bot
-- conversations (replaces an in-memory Map so an "awaiting
-- confirmation" survives a restart and works across instances).
-- Each row carries its own expiry so an unanswered confirmation
-- doesn't linger indefinitely.
-- =============================================================

create table if not exists public.conversation_state (
  user_key   text primary key,
  state      jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- =============================================================
-- Iteration 1 — country + per-country bank fields + mobile money
-- Run in Supabase SQL editor BEFORE deploying the code changes.
-- =============================================================

alter table public.businesses
  add column if not exists country               text not null default 'GB',
  add column if not exists bank_sort_code        text,   -- GB (encrypted)
  add column if not exists bank_routing_number   text,   -- US (encrypted)
  add column if not exists bank_account_type     text,   -- US: checking/savings (plain)
  add column if not exists bank_institution_no   text,   -- CA (encrypted)
  add column if not exists bank_transit_no       text,   -- CA (encrypted)
  add column if not exists bank_bsb              text,   -- AU (encrypted)
  add column if not exists bank_branch_code      text,   -- GH branch/sort (encrypted)
  add column if not exists bank_iban             text,   -- IE/DE/SEPA (encrypted)
  add column if not exists bank_swift_bic        text,   -- international (plain)
  add column if not exists mobile_money_provider text,   -- NG/GH (plain)
  add column if not exists mobile_money_number   text;   -- NG/GH (encrypted)