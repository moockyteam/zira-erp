-- 1. Create Supplier Categories Table (Hierarchical)
create table if not exists public.supplier_categories (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  
  name text not null,
  parent_id uuid references public.supplier_categories(id) on delete cascade -- For subcategories
);

-- 2. Create Suppliers Table
create table if not exists public.suppliers (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  
  name text not null,
  matricule_fiscal text,
  contact_person text,
  email text,
  phone_number text,
  
  -- Address
  address text,
  city text,
  country text default 'Tunisie',
  
  -- Banking
  iban text,
  bank_name text,
  
  -- Financials
  balance numeric default 0, -- Positive = Company owes money to supplier
  
  -- Classification
  category_id uuid references public.supplier_categories(id) on delete set null,
  subcategory_id uuid references public.supplier_categories(id) on delete set null,
  
  notes text
);

-- 3. Enable RLS
alter table public.suppliers enable row level security;
alter table public.supplier_categories enable row level security;

-- 4. RLS Policies

-- Suppliers
create policy "Users can view their company suppliers"
  on public.suppliers for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can manage their company suppliers"
  on public.suppliers for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Supplier Categories
create policy "Users can view their company supplier categories"
  on public.supplier_categories for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can manage their company supplier categories"
  on public.supplier_categories for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- 5. Indexes
create index if not exists suppliers_company_id_idx on public.suppliers(company_id);
create index if not exists suppliers_category_id_idx on public.suppliers(category_id);
create index if not exists supplier_categories_company_id_idx on public.supplier_categories(company_id);
