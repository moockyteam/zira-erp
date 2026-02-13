-- 1. Create Stock Issue Vouchers Table (Bons de Sortie)
create table if not exists public.stock_issue_vouchers (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  
  reference text not null,
  voucher_date timestamp with time zone not null default now(),
  reason text, -- ex: "Casse", "Péremption", "Usage interne"
  
  unique(company_id, reference)
);

-- 2. Create Stock Issue Voucher Lines Table
create table if not exists public.stock_issue_voucher_lines (
  id uuid default uuid_generate_v4() primary key,
  voucher_id uuid references public.stock_issue_vouchers(id) on delete cascade not null,
  item_id uuid references public.items(id) on delete restrict not null,
  
  quantity numeric not null check (quantity > 0)
);

-- 3. Enable RLS
alter table public.stock_issue_vouchers enable row level security;
alter table public.stock_issue_voucher_lines enable row level security;

-- 4. RLS Policies

-- Vouchers
create policy "Users can manage their company stock issue vouchers"
  on public.stock_issue_vouchers for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- Lines
create policy "Users can manage their stock issue voucher lines"
  on public.stock_issue_voucher_lines for all
  using (
    voucher_id in (select id from public.stock_issue_vouchers where company_id in (select id from public.companies where user_id = auth.uid()))
  );

-- 5. Indexes
create index if not exists siv_company_id_idx on public.stock_issue_vouchers(company_id);
create index if not exists sivl_voucher_id_idx on public.stock_issue_voucher_lines(voucher_id);

-- 6. Trigger for Stock Deduction (Recommended logic)
/*
CREATE OR REPLACE FUNCTION process_stock_issue_line()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.items
    SET quantity_on_hand = quantity_on_hand - NEW.quantity
    WHERE id = NEW.item_id;
    
    INSERT INTO public.stock_movements (
        company_id, item_id, quantity, movement_type, notes
    )
    SELECT company_id, NEW.item_id, -NEW.quantity, 'SORTIE', 'Bon de Sortie: ' || reference
    FROM public.stock_issue_vouchers WHERE id = NEW.voucher_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_process_stock_issue_line
AFTER INSERT ON public.stock_issue_voucher_lines
FOR EACH ROW EXECUTE FUNCTION process_stock_issue_line();
*/
