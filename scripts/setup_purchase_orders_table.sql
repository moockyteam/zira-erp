-- 1. Create Purchase Orders Table
create table if not exists public.purchase_orders (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  
  po_number text not null,
  order_date date not null default CURRENT_DATE,
  expected_delivery_date date,
  shipping_address text,
  
  status text not null default 'BROUILLON' check (status in ('BROUILLON', 'ENVOYE', 'RECU', 'ANNULE')),
  
  -- Financials
  total_ht numeric not null default 0,
  total_tva numeric not null default 0,
  total_ttc numeric not null default 0,
  
  notes text
);

-- 2. Create Purchase Order Lines Table
create table if not exists public.purchase_order_lines (
  id uuid default uuid_generate_v4() primary key,
  purchase_order_id uuid references public.purchase_orders(id) on delete cascade not null,
  
  item_id uuid references public.items(id) on delete set null, -- Null for free text items
  description text not null,
  quantity numeric not null default 1,
  purchase_price_ht numeric not null default 0,
  tva_rate numeric not null default 19,
  line_total_ht numeric generated always as (quantity * purchase_price_ht) stored
);

-- 3. Create Purchase Receipts Table (Bons de Réception)
create table if not exists public.purchase_receipts (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  
  receipt_number text not null,
  receipt_date date default CURRENT_DATE,
  notes text
);

-- 4. Create Purchase Receipt Lines Table
create table if not exists public.purchase_receipt_lines (
  id uuid default uuid_generate_v4() primary key,
  receipt_id uuid references public.purchase_receipts(id) on delete cascade not null,
  
  item_id uuid references public.items(id) on delete restrict, -- Must be stock item for receipts
  description text,
  quantity_received numeric not null
);

-- 5. Enable RLS
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_lines enable row level security;

-- 6. RLS Policies

-- Purchase Orders
create policy "Users can view their company purchase_orders"
  on public.purchase_orders for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can manage their company purchase_orders"
  on public.purchase_orders for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Purchase Order Lines
create policy "Users can view their purchase_order_lines"
  on public.purchase_order_lines for select
  using (
    purchase_order_id in (select id from public.purchase_orders where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

create policy "Users can manage their purchase_order_lines"
  on public.purchase_order_lines for all
  using (
    purchase_order_id in (select id from public.purchase_orders where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

-- Purchase Receipts
create policy "Users can view their company purchase_receipts"
  on public.purchase_receipts for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can manage their company purchase_receipts"
  on public.purchase_receipts for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Purchase Receipt Lines
create policy "Users can view their purchase_receipt_lines"
  on public.purchase_receipt_lines for select
  using (
    receipt_id in (select id from public.purchase_receipts where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

create policy "Users can manage their purchase_receipt_lines"
  on public.purchase_receipt_lines for all
  using (
    receipt_id in (select id from public.purchase_receipts where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

-- 7. Indexes
create index if not exists po_company_id_idx on public.purchase_orders(company_id);
create index if not exists po_supplier_id_idx on public.purchase_orders(supplier_id);
create index if not exists pol_po_id_idx on public.purchase_order_lines(purchase_order_id);
create index if not exists pr_po_id_idx on public.purchase_receipts(purchase_order_id);
