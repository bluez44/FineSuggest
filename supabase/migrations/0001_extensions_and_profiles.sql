-- 0001_extensions_and_profiles.sql
create extension if not exists vector;
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "users read own profile" on profiles
  for select using (id = auth.uid());

create policy "users update own profile" on profiles
  for update using (id = auth.uid());
