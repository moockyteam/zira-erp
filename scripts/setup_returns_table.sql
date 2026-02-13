-- 1. Create Return Vouchers Table
create table if not exists public.return_vouchers (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  
  return_voucher_number text not null,
  customer_id uuid references public.customers(id) on delete restrict not null,
  return_date date not null default current_date,
  
  source_document_ref text, -- Reference to the original invoice or DN
  notes text,
  
  -- Transport Info
  driver_name text,
  vehicle_registration text,
  
  status text not null default 'BROUILLON' check (status in ('BROUILLON', 'RETOURNE', 'ANNULE')),
  
  unique(company_id, return_voucher_number)
);

-- 2. Create Return Voucher Lines Table
create table if not exists public.return_voucher_lines (
  id uuid default uuid_generate_v4() primary key,
  return_voucher_id uuid references public.return_vouchers(id) on delete cascade not null,
  item_id uuid references public.items(id) on delete restrict not null,
  
  quantity numeric not null default 1,
  reason text
);

-- 3. Enable RLS
alter table public.return_vouchers enable row level security;
alter table public.return_voucher_lines enable row level security;

-- 4. RLS Policies

-- Return Vouchers
create policy "Users can view their company return vouchers"
  on public.return_vouchers for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can manage their company return vouchers"
  on public.return_vouchers for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Lines
create policy "Users can view their return voucher lines"
  on public.return_voucher_lines for select
  using (
    return_voucher_id in (select id from public.return_vouchers where company_id in (select id from public.companies where user_id = auth.uid()))
  );

create policy "Users can manage their return voucher lines"
  on public.return_voucher_lines for all
  using (
    return_voucher_id in (select id from public.return_vouchers where company_id in (select id from public.companies where user_id = auth.uid()))
  );

-- 5. Indexes
create index if not exists rv_company_id_idx on public.return_vouchers(company_id);
create index if not exists rv_customer_id_idx on public.return_vouchers(customer_id);
create index if not exists rvl_rv_id_idx on public.return_voucher_lines(return_voucher_id);
