-- 1. Create Expense Categories Table
create table if not exists public.expense_categories (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade, -- Null for system-wide categories
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Recurring Expenses Table
create table if not exists public.recurring_expenses (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  category_id uuid references public.expense_categories(id) on delete set null,
  
  title text not null,
  description text,
  beneficiary text,
  
  amount numeric(15, 3) not null,
  currency text default 'TND',
  frequency text not null, -- MENSUEL, BIMENSUEL, etc.
  
  start_date date not null,
  end_date date,
  next_execution_date date,
  
  payment_method text,
  is_active boolean default true,
  
  -- Pre-calculated values for generation
  total_ht numeric(15, 3),
  total_tva numeric(15, 3),
  total_ttc numeric(15, 3),
  has_withholding_tax boolean default false,
  withholding_tax_amount numeric(15, 3),
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Expenses Table
create table if not exists public.expenses (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  category_id uuid references public.expense_categories(id) on delete set null,
  
  beneficiary text not null,
  reference text, -- Facture #, Ticket #
  notes text,
  
  total_ht numeric(15, 3),
  total_tva numeric(15, 3),
  total_ttc numeric(15, 3) not null,
  currency text default 'TND',
  
  tva_details jsonb, -- Breakdown of TVA by rate
  
  has_withholding_tax boolean default false,
  withholding_tax_amount numeric(15, 3),
  
  payment_date date not null,
  due_date date,
  payment_method text, -- Virement, Chèque, Espèces, etc.
  status text not null default 'PAYE', -- PAYE, EN_ATTENTE, ANNULE
  
  attachment_url text, -- Link to receipt/invoice file
  
  is_recurring boolean default false,
  recurring_expense_id uuid references public.recurring_expenses(id) on delete set null,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Expense Schedules Table (For staggered payments)
create table if not exists public.expense_schedules (
  id uuid default uuid_generate_v4() primary key,
  expense_id uuid references public.expenses(id) on delete cascade not null,
  due_date date not null,
  amount numeric(15, 3) not null,
  currency text default 'TND',
  payment_method text,
  reference text,
  status text default 'pending', -- pending, paid
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Enable RLS
alter table public.expense_categories enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_schedules enable row level security;

-- 6. RLS Policies (Example for Expenses)
create policy "Users can manage their company expenses"
  on public.expenses for all
  using (
    company_id in (select id from public.companies where user_id = auth.uid())
  );

-- (Apply similar policies for categories, recurring, and schedules)

-- 7. Indexes
create index if not exists exp_company_idx on public.expenses(company_id);
create index if not exists exp_payment_date_idx on public.expenses(payment_date);
create index if not exists rec_exp_next_date_idx on public.recurring_expenses(next_execution_date);
