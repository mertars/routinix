-- =====================================================================
-- AI PlanStudio — Eksiksiz Şema Migration Script'i
-- Supabase SQL Editor'a yapıştırıp "Run" ile tek seferde çalıştırabilirsin.
--
-- UYARI: Aşağıdaki DROP komutları mevcut plans / routines / tasks
-- tablolarını (ve içindeki TÜM veriyi) siler. Prod veride kullanacaksan
-- önce yedek al. Sıfırdan/temiz kurulum için tasarlandı.
-- =====================================================================

-- UUID üretimi için (Supabase'de genelde zaten açıktır, garanti olsun diye).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 0) Eski tabloları güvenli şekilde temizle (çocuk → ebeveyn sırasıyla).
--    CASCADE, bağlı foreign key'leri ve RLS policy'lerini de düşürür.
-- ---------------------------------------------------------------------
drop table if exists public.tasks cascade;
drop table if exists public.routines cascade;
drop table if exists public.plans cascade;

-- ---------------------------------------------------------------------
-- 1) plans — ana plan kaydı
-- ---------------------------------------------------------------------
create table public.plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  summary    text,
  mode       text not null default 'general'
             check (mode in ('software', 'fitness', 'vacation', 'general')),
  created_at timestamptz not null default now()
);

create index plans_user_id_idx on public.plans (user_id);
create index plans_created_at_idx on public.plans (created_at desc);

-- ---------------------------------------------------------------------
-- 2) routines — plana ait genel rutinler
-- ---------------------------------------------------------------------
create table public.routines (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.plans (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  content    text not null,
  frequency  text not null default 'weekly',
  created_at timestamptz not null default now()
);

create index routines_plan_id_idx on public.routines (plan_id);
create index routines_user_id_idx on public.routines (user_id);

-- ---------------------------------------------------------------------
-- 3) tasks — plana ait, hafta/gün bazlı görevler
-- ---------------------------------------------------------------------
create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  plan_id          uuid not null references public.plans (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  week_number      int  not null default 1,
  day_number       int  not null default 1,
  title            text not null,
  detail           text,
  estimated_cost   text,
  map_search_query text,
  is_completed     boolean not null default false,
  created_at       timestamptz not null default now()
);

create index tasks_plan_id_idx on public.tasks (plan_id);
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_plan_week_idx on public.tasks (plan_id, week_number, day_number);

-- =====================================================================
-- 4) Row Level Security — her kullanıcı yalnızca kendi verisine erişir
-- =====================================================================

-- plans -----------------------------------------------------------------
alter table public.plans enable row level security;

create policy "plans_select_own" on public.plans
  for select using (auth.uid() = user_id);
create policy "plans_insert_own" on public.plans
  for insert with check (auth.uid() = user_id);
create policy "plans_update_own" on public.plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "plans_delete_own" on public.plans
  for delete using (auth.uid() = user_id);

-- routines --------------------------------------------------------------
alter table public.routines enable row level security;

create policy "routines_select_own" on public.routines
  for select using (auth.uid() = user_id);
create policy "routines_insert_own" on public.routines
  for insert with check (auth.uid() = user_id);
create policy "routines_update_own" on public.routines
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "routines_delete_own" on public.routines
  for delete using (auth.uid() = user_id);

-- tasks -----------------------------------------------------------------
alter table public.tasks enable row level security;

create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- Bitti. plans / routines / tasks tabloları RLS açık şekilde hazır.
-- =====================================================================
