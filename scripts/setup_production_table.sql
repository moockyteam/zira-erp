-- Note: Production in this system relies on Stock and BOM tables already defined.
-- This script ensures the necessary RPC and optional tracking tables are present.

-- 1. Production Orders (Optional but recommended for tracking)
create table if not exists public.production_orders (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  
  item_id uuid references public.items(id) on delete restrict not null, -- What is being made
  quantity_planned numeric not null,
  quantity_produced numeric default 0,
  
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  
  status text default 'PROGRAMMEE' check (status in ('PROGRAMMEE', 'EN_COURS', 'TERMINEE', 'ANNULEE')),
  notes text,
  
  created_by uuid references auth.users(id)
);

-- 2. Production Components (Used in a specific order, captures snapshot of BOM)
create table if not exists public.production_order_components (
  id uuid default uuid_generate_v4() primary key,
  production_order_id uuid references public.production_orders(id) on delete cascade not null,
  item_id uuid references public.items(id) on delete restrict not null,
  quantity_required numeric not null,
  quantity_consumed numeric default 0
);

-- 3. The Core Production Function (Conceptually what perform_product_assembly does)
-- This function:
-- 1. Validates stock for all components in BOM
-- 2. Deducts components from stock (Stock Movement: SORTIE)
-- 3. Adds finished product to stock (Stock Movement: ENTREE)
-- 4. Logs everything atomicaly

/* 
Example logic for the RPC (to be implemented in Supabase):

CREATE OR REPLACE FUNCTION perform_product_assembly(
    p_company_id UUID,
    p_item_id UUID,
    p_quantity_to_produce NUMERIC
) RETURNS JSON AS $$
DECLARE
    v_bom_count INT;
    v_missing_item_name TEXT;
    v_total_cost NUMERIC := 0;
BEGIN
    -- [Logic to check BOM, check stock, loop and insert movements]
    -- [Return success/error json]
END;
$$ LANGUAGE plpgsql;
*/

-- 4. RLS Policies
alter table public.production_orders enable row level security;
alter table public.production_order_components enable row level security;

create policy "Users can manage their company production orders"
  on public.production_orders for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

create policy "Users can manage their production order components"
  on public.production_order_components for all
  using (
    production_order_id in (select id from public.production_orders where 
      company_id in (select id from public.companies where user_id = auth.uid())
    )
  );

-- 5. Indexes
create index if not exists po_item_id_idx on public.production_orders(item_id);
create index if not exists po_status_idx on public.production_orders(status);
