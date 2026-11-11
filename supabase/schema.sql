-- Unfolding People — customer accounts (Supabase / PostgreSQL)
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this → Run.
-- Row Level Security means every customer can only read and change their own rows.

-- A profile per signed-in customer (created automatically on first sign-in)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

-- Designs a customer saves from the studio
create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  product text not null check (product in ('tshirt', 'hoodie')),
  name text,
  design jsonb not null,           -- colour + front/back layers, exactly as the studio stores it
  preview text,                    -- small PNG data URL of the front, for the "My designs" list
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists designs_user_idx on public.designs (user_id, updated_at desc);

-- A customer's order history (the full order is stored privately on the server; this is the summary)
create table if not exists public.orders (
  id text primary key,             -- the order number, e.g. UP-261111-4827
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  product text not null,
  colour text,
  size text,
  total numeric(10, 2),
  status text not null default 'awaiting_payment',
  created_at timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.designs enable row level security;
alter table public.orders enable row level security;

-- profiles: read and update your own
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- designs: full control over your own
drop policy if exists "own designs" on public.designs;
create policy "own designs" on public.designs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- orders: read your own, add your own (status stays as set by the shop)
drop policy if exists "own orders read" on public.orders;
create policy "own orders read" on public.orders for select using (auth.uid() = user_id);
drop policy if exists "own orders insert" on public.orders;
create policy "own orders insert" on public.orders for insert
  with check (auth.uid() = user_id and status = 'awaiting_payment');

-- create the profile row when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
