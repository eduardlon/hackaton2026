create table if not exists payment_requests (
  id text primary key,
  receiver_user_id text not null,
  payer_user_id text,
  amount numeric not null check (amount > 0),
  currency text not null default 'COP',
  nonce text not null unique,
  token_hash text not null unique,
  signature text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'expired', 'cancelled')),
  note text,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  completed_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_requests_receiver_idx
  on payment_requests (receiver_user_id, created_at desc);

create index if not exists payment_requests_payer_idx
  on payment_requests (payer_user_id, created_at desc);

create index if not exists payment_requests_status_expiry_idx
  on payment_requests (status, expires_at);
