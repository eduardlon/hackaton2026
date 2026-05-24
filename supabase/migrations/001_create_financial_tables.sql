-- Financial core tables for CrediGrow
-- Migration 001: Create wallets, passports, credit_profiles, transactions, loans

-- 1. WALLETS
create table if not exists wallets (
  user_id uuid primary key references phone_users(id) on delete cascade,
  balance bigint not null default 0,
  currency text not null default 'COP',
  monthly_income bigint not null default 0,
  monthly_expenses bigint not null default 0,
  pending_bills bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. PASSPORTS
create table if not exists passports (
  user_id uuid primary key references phone_users(id) on delete cascade,
  points integer not null default 0,
  level integer not null default 1,
  level_name text not null default 'Inicial',
  next_level_points integer not null default 1000,
  progress_percentage integer not null default 0,
  next_benefit text not null default '',
  monthly_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. PASSPORT EVENTS
create table if not exists passport_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references phone_users(id) on delete cascade,
  event_type text not null,
  points_delta integer not null default 0,
  reason text not null default '',
  created_at timestamptz not null default now()
);

-- 4. TRANSACTIONS
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references phone_users(id) on delete cascade,
  type text not null,
  amount bigint not null,
  category text not null default '',
  description text not null default '',
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

-- 5. CREDIT PROFILES
create table if not exists credit_profiles (
  user_id uuid primary key references phone_users(id) on delete cascade,
  available_amount bigint not null default 0,
  max_amount bigint not null default 0,
  used_amount bigint not null default 0,
  safe_monthly_payment bigint not null default 0,
  risk text not null default 'medio',
  eligibility integer not null default 0,
  level text not null default 'Sin perfil financiero',
  next_tier_amount bigint not null default 0,
  points_to_next_tier integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. LOANS
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references phone_users(id) on delete cascade,
  original_amount bigint not null,
  paid_amount bigint not null default 0,
  outstanding_balance bigint not null,
  next_payment_amount bigint not null default 0,
  term_months integer not null default 0,
  purpose text not null default '',
  monthly_payment bigint not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disbursed_at timestamptz
);

-- Indexes for performance
create index if not exists idx_transactions_user_id on transactions(user_id);
create index if not exists idx_transactions_created_at on transactions(created_at desc);
create index if not exists idx_passport_events_user_id on passport_events(user_id);
create index if not exists idx_passport_events_created_at on passport_events(created_at desc);
create index if not exists idx_loans_user_id on loans(user_id);
create index if not exists idx_loans_status on loans(status);

-- Enable RLS (disabled by default for function access; functions use service_role)
-- alter table wallets enable row level security;
-- alter table passports enable row level security;
-- alter table passport_events enable row level security;
-- alter table transactions enable row level security;
-- alter table credit_profiles enable row level security;
-- alter table loans enable row level security;
