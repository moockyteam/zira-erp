-- 1. Create Invoices Table
create table if not exists public.invoices (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete set null,
  
  invoice_number text not null,
  invoice_date date not null default CURRENT_DATE,
  due_date date,
  status text not null default 'BROUILLON' check (status in ('BROUILLON', 'ENVOYE', 'PAYEE', 'PARTIELLEMENT_PAYEE', 'ANNULEE')),
  
  -- Financials
  currency text not null default 'TND',
  total_ht numeric not null default 0,
  total_remise numeric not null default 0,
  total_fodec numeric not null default 0,
  total_tva numeric not null default 0,
  total_ttc numeric not null default 0,
  
  -- Options
  has_stamp boolean default true,
  show_remise_column boolean default false,
  has_withholding_tax boolean default false,
  withholding_tax_amount numeric default 0,
  
  -- Origin
  quote_id uuid references public.quotes(id) on delete set null,
  source_delivery_note_id uuid, -- references delivery_notes(id)
  
  -- Text fields
  notes text,
  payment_terms text,
  
  -- Bank Details (Snapshot at time of invoice)
  bank_name text,
  iban text,
  bic_swift text,
  rib text
);

-- 2. Create Invoice Lines Table
create table if not exists public.invoice_lines (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  
  item_id uuid, -- references public.items(id)
  service_id uuid references public.services(id) on delete set null,
  
  description text not null,
  quantity numeric not null default 1,
  unit_price_ht numeric not null default 0,
  remise_percentage numeric not null default 0,
  tva_rate numeric not null default 19
);

-- 3. Create Invoice Payments Table
create table if not exists public.invoice_payments (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  
  amount numeric not null,
  payment_date date default CURRENT_DATE,
  payment_method text, -- 'ESPECES', 'CHEQUE', 'VIREMENT', 'TRAITE'
  notes text,
  
  -- Cheque/Traite details
  bank_name text,
  check_number text,
  check_date date
);

-- 4. Create View for Invoices with Totals (Calculated Fields)
create or replace view public.invoices_with_totals as
select 
  i.*,
  coalesce((select sum(p.amount) from public.invoice_payments p where p.invoice_id = i.id), 0) as total_paid,
  (i.total_ttc - coalesce((select sum(p.amount) from public.invoice_payments p where p.invoice_id = i.id), 0)) as amount_due
from public.invoices i;

-- 5. Enable RLS
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_payments enable row level security;

-- 6. RLS Policies

-- Invoices
create policy "Users can view their company invoices"
  on public.invoices for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can insert invoices for their companies"
  on public.invoices for insert
  with check (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can update their company invoices"
  on public.invoices for update
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can delete their company invoices"
  on public.invoices for delete
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Invoice Lines
create policy "Users can view their invoice lines"
  on public.invoice_lines for select
  using (
    invoice_id in (select id from public.invoices where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

create policy "Users can manage their invoice lines"
  on public.invoice_lines for all
  using (
    invoice_id in (select id from public.invoices where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

-- Invoice Payments
create policy "Users can view their invoice payments"
  on public.invoice_payments for select
  using (
    invoice_id in (select id from public.invoices where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

create policy "Users can manage their invoice payments"
  on public.invoice_payments for all
  using (
    invoice_id in (select id from public.invoices where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

-- 7. Indexes
create index if not exists invoices_company_id_idx on public.invoices(company_id);
create index if not exists invoices_customer_id_idx on public.invoices(customer_id);
create index if not exists invoice_lines_invoice_id_idx on public.invoice_lines(invoice_id);
create index if not exists invoice_payments_invoice_id_idx on public.invoice_payments(invoice_id);
