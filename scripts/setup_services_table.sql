-- 1. Create Service Categories Table
create table if not exists public.service_categories (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade, -- Nullable for system categories
  name text not null
);

-- 2. Create Services Table
create table if not exists public.services (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  category_id uuid references public.service_categories(id) on delete set null,
  
  name text not null,
  sku text,
  short_description text,
  detailed_description text,
  
  -- Pricing
  price numeric not null default 0,
  currency text not null default 'TND',
  vat_rate numeric not null default 19,
  cost_price numeric,
  
  -- Characteristics
  billing_type text not null, -- 'fixed', 'hourly', 'daily', 'subscription'
  unit text, -- 'Month', 'Year' (only for subscription)
  estimated_duration numeric, -- in hours or days depending on context logic
  
  status text not null default 'active' check (status in ('active', 'archived'))
);

-- 3. Enable RLS
alter table public.service_categories enable row level security;
alter table public.services enable row level security;

-- 4. RLS Policies

-- Service Categories
-- Users can view system categories (company_id is null) OR their own company categories
create policy "Users can view relevant categories"
  on public.service_categories for select
  using (
    company_id is null 
    or 
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can manage their company categories"
  on public.service_categories for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Services
-- Users can view and manage services for their companies
create policy "Users can view their company services"
  on public.services for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can insert services for their companies"
  on public.services for insert
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can update their company services"
  on public.services for update
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can delete their company services"
  on public.services for delete
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- 5. Indexes
create index if not exists services_company_id_idx on public.services(company_id);
create index if not exists services_name_idx on public.services(name);
