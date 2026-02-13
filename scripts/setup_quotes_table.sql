-- 1. Create Quotes Table
create table if not exists public.quotes (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete set null,
  
  -- Generates via Edge Function usually, but stored here
  quote_number text not null,
  quote_date date not null default CURRENT_DATE,
  status text not null default 'BROUILLON' check (status in ('BROUILLON', 'ENVOYE', 'CONFIRME', 'REFUSE')),
  
  -- Prospect details (if no customer_id)
  prospect_name text,
  prospect_address text,
  prospect_email text,
  prospect_phone text,
  
  -- Financials
  currency text not null default 'TND',
  total_ht numeric not null default 0,
  total_remise numeric not null default 0,
  total_fodec numeric not null default 0,
  total_tva numeric not null default 0,
  total_ttc numeric not null default 0,
  
  -- Options
  has_stamp boolean default true,
  show_remise_column boolean default true,
  
  -- Text fields
  notes text,
  terms_and_conditions text
);

-- 2. Create Quote Lines Table
create table if not exists public.quote_lines (
  id uuid default uuid_generate_v4() primary key,
  quote_id uuid references public.quotes(id) on delete cascade not null,
  
  -- Link to Service OR Item (Inventory)
  service_id uuid references public.services(id) on delete set null,
  item_id uuid, -- references public.items(id) on delete set null, -- Uncomment when items table exists
  
  description text not null,
  quantity numeric not null default 1,
  unit_price_ht numeric not null default 0,
  remise_percentage numeric not null default 0,
  tva_rate numeric not null default 19,
  
  line_total_ht numeric not null default 0
);

-- 3. Create Company Defaults (for terms, etc.)
create table if not exists public.company_defaults (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null unique,
  default_quote_terms text,
  default_invoice_terms text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Enable RLS
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.company_defaults enable row level security;

-- 5. RLS Policies

-- Quotes
create policy "Users can view their company quotes"
  on public.quotes for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can insert quotes for their companies"
  on public.quotes for insert
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can update their company quotes"
  on public.quotes for update
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can delete their company quotes"
  on public.quotes for delete
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Quote Lines
create policy "Users can view their quote lines"
  on public.quote_lines for select
  using (
    quote_id in (select id from public.quotes where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

create policy "Users can manage their quote lines"
  on public.quote_lines for all
  using (
    quote_id in (select id from public.quotes where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

-- Company Defaults
create policy "Users can view their company defaults"
  on public.company_defaults for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can manage their company defaults"
  on public.company_defaults for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- 6. Indexes
create index if not exists quotes_company_id_idx on public.quotes(company_id);
create index if not exists quotes_customer_id_idx on public.quotes(customer_id);
create index if not exists quote_lines_quote_id_idx on public.quote_lines(quote_id);
