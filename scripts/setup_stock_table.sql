-- 1. Create Items Table
create table if not exists public.items (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  
  name text not null,
  reference text,
  type text not null default 'product' check (type in ('product', 'raw_material', 'semi_finished', 'consumable', 'asset')),
  description text,
  
  -- Classification
  category_id uuid references public.supplier_categories(id) on delete set null,
  subcategory_id uuid references public.supplier_categories(id) on delete set null,
  
  -- Inventory
  quantity_on_hand numeric not null default 0,
  unit_of_measure text default 'pièce',
  consumption_unit text, -- For raw materials
  alert_quantity numeric default 0,
  
  -- Pricing
  default_purchase_price numeric,
  sale_price numeric,
  
  is_archived boolean default false
);

-- 2. Create Item-Supplier Link Table
create table if not exists public.item_suppliers (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  item_id uuid references public.items(id) on delete cascade not null,
  supplier_id uuid references public.suppliers(id) on delete cascade not null,
  
  supplier_item_reference text,
  last_purchase_price numeric,
  
  unique(item_id, supplier_id)
);

-- 3. Create Stock Movements Table
create table if not exists public.stock_movements (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  
  item_id uuid references public.items(id) on delete cascade not null,
  
  movement_type text not null check (movement_type in ('ENTREE', 'SORTIE', 'AJUSTEMENT', 'PRODUCTION', 'VENTE', 'ACHAT')),
  quantity numeric not null, -- Positive for IN, Negative for OUT (usually handled by logic, but stored as absolute magnitude typically, with type determining sign)
  
  -- Context
  supplier_id uuid references public.suppliers(id) on delete set null,
  notes text,
  unit_price numeric, -- Price at the moment of movement
  
  created_by uuid references auth.users(id)
);

-- 4. Create Bill of Materials Table (Recipes)
create table if not exists public.bill_of_materials (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  parent_item_id uuid references public.items(id) on delete cascade not null, -- The finished product
  child_item_id uuid references public.items(id) on delete restrict not null, -- The ingredient
  
  quantity numeric not null, -- Amount needed for 1 unit of parent
  
  unique(parent_item_id, child_item_id)
);

-- 5. Enable RLS
alter table public.items enable row level security;
alter table public.item_suppliers enable row level security;
alter table public.stock_movements enable row level security;
alter table public.bill_of_materials enable row level security;

-- 6. RLS Policies

-- Items
create policy "Users can view their company items"
  on public.items for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can manage their company items"
  on public.items for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Item Suppliers
create policy "Users can view their item suppliers"
  on public.item_suppliers for select
  using (
    item_id in (select id from public.items where company_id in (select id from public.companies where user_id = auth.uid()))
  );

create policy "Users can manage their item suppliers"
  on public.item_suppliers for all
  using (
    item_id in (select id from public.items where company_id in (select id from public.companies where user_id = auth.uid()))
  );

-- Stock Movements
create policy "Users can view their company stock movements"
  on public.stock_movements for select
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can manage their company stock movements"
  on public.stock_movements for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Bill of Materials
create policy "Users can view their BOMs"
  on public.bill_of_materials for select
  using (
    parent_item_id in (select id from public.items where company_id in (select id from public.companies where user_id = auth.uid()))
  );

create policy "Users can manage their BOMs"
  on public.bill_of_materials for all
  using (
    parent_item_id in (select id from public.items where company_id in (select id from public.companies where user_id = auth.uid()))
  );

-- 7. Indexes
create index if not exists items_company_id_idx on public.items(company_id);
create index if not exists items_category_id_idx on public.items(category_id);
create index if not exists sm_item_id_idx on public.stock_movements(item_id);
create index if not exists sm_created_at_idx on public.stock_movements(created_at);
