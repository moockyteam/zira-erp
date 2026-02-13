-- 1. Create Global Payments Table
-- This table acts as a master record for any payment RECEIVED from a customer.
create table if not exists public.global_payments (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete cascade not null,
  
  amount numeric(15, 3) not null,
  payment_method text not null, -- ESPECES, CHEQUE, VIREMENT, AVOIR, etc.
  payment_date date not null default current_date,
  
  notes text,
  reference text, -- ex: Chèque n°123
  
  -- Tracking allocation status
  is_allocated boolean default false,
  unallocated_amount numeric(15, 3) default 0
);

-- 2. Link Tables (Refined versions of what we saw in module documentation)
-- These tables link a payment to a specific document.

-- Linked to Invoices
create table if not exists public.invoice_payments (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  global_payment_id uuid references public.global_payments(id) on delete cascade,
  amount numeric(15, 3) not null,
  payment_date date default current_date
);

-- Linked to Delivery Notes (BL)
create table if not exists public.delivery_note_payments (
  id uuid default uuid_generate_v4() primary key,
  delivery_note_id uuid references public.delivery_notes(id) on delete cascade not null,
  global_payment_id uuid references public.global_payments(id) on delete cascade,
  amount numeric(15, 3) not null,
  payment_date date default current_date
);

-- 3. Allocation Logic (The Core Concept)
/*
The record_global_payment function implements FIFO (First-In-First-Out):
1. Find all unpaid Invoices and BLs for the customer.
2. Sort them by date (oldest first).
3. Loop through them and subtract the remaining payment amount until it is 0.
4. Any leftover amount stays in global_payments as 'unallocated' (Customer Credit).
*/

-- 4. RLS
alter table public.global_payments enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.delivery_note_payments enable row level security;

create policy "Users can manage global payments"
  on public.global_payments for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- 5. Indexes
create index if not exists gp_customer_idx on public.global_payments(customer_id);
create index if not exists gp_company_idx on public.global_payments(company_id);
create index if not exists ip_invoice_idx on public.invoice_payments(invoice_id);
create index if not exists dnp_dn_idx on public.delivery_note_payments(delivery_note_id);
