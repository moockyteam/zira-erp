-- 1. Create Delivery Notes Table
create table if not exists public.delivery_notes (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  
  delivery_note_number text not null,
  customer_id uuid references public.customers(id) on delete restrict not null,
  delivery_date date not null default current_date,
  delivery_address text,
  
  -- Transport Info
  driver_name text,
  vehicle_registration text,
  
  -- Status & Financials
  status text not null default 'BROUILLON' check (status in ('BROUILLON', 'LIVRE', 'ANNULE')),
  is_valued boolean default true,
  show_remise_column boolean default false,
  total_ht numeric(15, 3) default 0,
  total_ttc numeric(15, 3) default 0,
  
  -- Link to Invoice (once converted)
  invoice_id uuid references public.invoices(id) on delete set null,
  
  -- Optional Bank Details for the document
  bank_name text,
  iban text,
  bic_swift text,
  rib text,
  
  show_manager_name boolean default false,
  notes text,
  
  unique(company_id, delivery_note_number)
);

-- 2. Create Delivery Note Lines Table
create table if not exists public.delivery_note_lines (
  id uuid default uuid_generate_v4() primary key,
  delivery_note_id uuid references public.delivery_notes(id) on delete cascade not null,
  item_id uuid references public.items(id) on delete set null,
  
  description text not null,
  quantity numeric not null default 1,
  unit_price_ht numeric(15, 3) default 0,
  remise_percentage numeric default 0,
  tva_rate numeric default 19,
  
  sort_order int default 0
);

-- 3. Create Delivery Note Payments Table (Optional tracker if paid before invoice)
create table if not exists public.delivery_note_payments (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  delivery_note_id uuid references public.delivery_notes(id) on delete cascade not null,
  
  amount numeric(15, 3) not null,
  payment_method text check (payment_method in ('ESPECE', 'CHEQUE', 'VIREMENT', 'TRAITE', 'AUTRE')),
  payment_date date not null default current_date,
  reference text,
  notes text
);

-- 4. Enable RLS
alter table public.delivery_notes enable row level security;
alter table public.delivery_note_lines enable row level security;
alter table public.delivery_note_payments enable row level security;

-- 5. RLS Policies

-- Delivery Notes
create policy "Users can view their company delivery notes"
  on public.delivery_notes for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can manage their company delivery notes"
  on public.delivery_notes for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Lines
create policy "Users can view their delivery note lines"
  on public.delivery_note_lines for select
  using (
    delivery_note_id in (select id from public.delivery_notes where company_id in (select id from public.companies where user_id = auth.uid()))
  );

create policy "Users can manage their delivery note lines"
  on public.delivery_note_lines for all
  using (
    delivery_note_id in (select id from public.delivery_notes where company_id in (select id from public.companies where user_id = auth.uid()))
  );

-- Payments
create policy "Users can manage their dn payments"
  on public.delivery_note_payments for all
  using (
    delivery_note_id in (select id from public.delivery_notes where company_id in (select id from public.companies where user_id = auth.uid()))
  );

-- 6. Indexes
create index if not exists dn_company_id_idx on public.delivery_notes(company_id);
create index if not exists dn_customer_id_idx on public.delivery_notes(customer_id);
create index if not exists dnl_dn_id_idx on public.delivery_note_lines(delivery_note_id);
