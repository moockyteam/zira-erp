-- 1. Create Customers Table
create table if not exists public.customers (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  
  name text not null,
  customer_type text not null default 'ENTREPRISE' check (customer_type in ('ENTREPRISE', 'PARTICULIER')),
  matricule_fiscal text,
  contact_person text,
  email text,
  phone_number text,
  website text,
  
  -- Financials
  balance numeric default 0, -- Often updated via triggers/RPCs
  initial_balance numeric default 0,
  balance_start_date date,
  is_subject_to_vat boolean default true
);

-- 2. Create Customer Addresses Table
create table if not exists public.customer_addresses (
  id uuid default uuid_generate_v4() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  
  type text not null default 'LIVRAISON' check (type in ('LIVRAISON', 'FACTURATION', 'AUTRE')),
  address_line1 text,
  address_line2 text,
  city text,
  state text, -- Governorate
  postal_code text,
  country text default 'Tunisie',
  is_default boolean default false
);

-- 3. Create Customer Special Pricing (Items/Services)
create table if not exists public.customer_items (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  customer_id uuid references public.customers(id) on delete cascade not null,
  
  -- Links to either a Service or an Item (Inventory)
  service_id uuid references public.services(id) on delete cascade,
  -- item_id uuid references public.inventory_items(id) on delete cascade, -- Uncomment if inventory exists
  item_id uuid, -- Placeholder if inventory table is not yet documented/created in this context
  
  special_price numeric,
  special_vat_rate numeric,
  
  -- Subscription details
  subscription_start_date date,
  subscription_renewal_date date
);

-- 4. Enable RLS
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.customer_items enable row level security;

-- 5. RLS Policies

-- Customers
create policy "Users can view their company customers"
  on public.customers for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can insert customers for their companies"
  on public.customers for insert
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can update their company customers"
  on public.customers for update
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can delete their company customers"
  on public.customers for delete
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Addresses
create policy "Users can view their customer adresses"
  on public.customer_addresses for select
  using (
    customer_id in (select id from public.customers where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

create policy "Users can manage their customer adresses"
  on public.customer_addresses for all
  using (
    customer_id in (select id from public.customers where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

-- Customer Items (Special Pricing)
create policy "Users can view their customer special prices"
  on public.customer_items for select
  using (
    customer_id in (select id from public.customers where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

create policy "Users can manage their customer special prices"
  on public.customer_items for all
  using (
    customer_id in (select id from public.customers where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

-- 6. Indexes
create index if not exists customers_company_id_idx on public.customers(company_id);
create index if not exists customers_name_idx on public.customers(name);
create index if not exists customer_addresses_customer_id_idx on public.customer_addresses(customer_id);
create index if not exists customer_items_customer_id_idx on public.customer_items(customer_id);
