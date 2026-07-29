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
  total_days int,
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
  duration_min     int,
  priority         text,
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
-- GÜVENLİK SERTLEŞTİRME: tasks satırları artık istemciden (anon key + kullanıcı
-- JWT'si) TOPLU SİLİNEMEZ ve yalnızca "is_completed" kolonu doğrudan
-- güncellenebilir (checkbox tiklemesi). duration_min/priority/day_number/title
-- gibi "yüksek yetkili" alanlar SADECE api/coach-action.js üzerinden,
-- service_role ile değiştirilebilir. Bir plan tamamen silinince (plans_delete_own)
-- ona bağlı tasks satırları zaten ON DELETE CASCADE ile otomatik silinir —
-- bu yüzden tasks için ayrı bir "delete" policy'sine hiç ihtiyaç yok.
alter table public.tasks enable row level security;

create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Bilerek YOK: "tasks_delete_own". Doğrudan client-side toplu silme kapalı.

-- Kolon bazlı yetki daraltma: RLS satır erişimine izin verse bile,
-- authenticated rolü UPDATE ile yalnızca is_completed kolonuna dokunabilir.
revoke update on public.tasks from authenticated;
grant update (is_completed) on public.tasks to authenticated;

-- =====================================================================
-- Bitti. plans / routines / tasks tabloları RLS açık şekilde hazır.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ALTERNATİF: Tabloları YENİDEN OLUŞTURMAK (yukarıdaki DROP'lar) yerine,
-- mevcut tasks tablosuna sadece yeni kolonları eklemek istersen aşağıyı
-- tek başına çalıştır (veriyi korur):
--
--   alter table public.plans add column if not exists total_days int;
--   alter table public.tasks add column if not exists duration_min int;
--   alter table public.tasks add column if not exists priority text;
--
--   -- Güvenlik sertleştirme (tabloları yeniden oluşturmadan, var olan
--   -- kuruluma tek başına uygulanabilir):
--   drop policy if exists "tasks_delete_own" on public.tasks;
--   revoke update on public.tasks from authenticated;
--   grant update (is_completed) on public.tasks to authenticated;
-- ---------------------------------------------------------------------

-- =====================================================================
-- 5) logs — hafif frontend logging / error tracking (yalnızca WARN + ERROR)
--    Bu tablo yukarıdaki DROP bloğuna DAHİL DEĞİL — var olan plans/routines/
--    tasks verini etkilemeden, bu bloğu tek başına çalıştırabilirsin.
--    src/utils/logger.js -> sendToExternalService -> src/services/logService.js
--    zinciriyle her warn/error burada kalıcılaşır.
-- =====================================================================
create table if not exists public.logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  level      text not null check (level in ('warn', 'error')),
  scope      text not null default 'APP',
  message    text not null,
  data       jsonb,
  user_agent text,
  url        text,
  created_at timestamptz not null default now()
);

create index if not exists logs_user_id_idx on public.logs (user_id);
create index if not exists logs_created_at_idx on public.logs (created_at desc);

alter table public.logs enable row level security;

-- Misafir (giriş yapmamış) kullanıcılardan gelen hatalar da kaydedilsin diye
-- user_id NULL olan insert'lere izin verilir; oturum açıksa yalnızca kendi
-- user_id'siyle yazabilir (başkası adına log yazılamaz).
create policy "logs_insert_own_or_anon" on public.logs
  for insert with check (user_id is null or auth.uid() = user_id);

-- Kullanıcı yalnızca kendi loglarını görebilir (ileride bir "hata geçmişi"
-- ekranı gerekirse hazır; admin/servis rolü ayrıca genişletilebilir).
create policy "logs_select_own" on public.logs
  for select using (auth.uid() = user_id);

-- GÜVENLİK: src/services/logService.js'teki debounce/rate-limit YALNIZCA
-- istemci tarafı bir nezaket katmanı — biri anon key ile doğrudan Supabase
-- REST API'sine istek atarak bunu bypass edebilir. Bu yüzden gerçek sınır
-- burada, veritabanı seviyesinde: bir kullanıcı son 1 dakikada 30'dan fazla
-- log satırı ekleyemez (log injection/spam koruması). user_id NULL olan
-- (misafir) loglar için kararlı bir kimlik olmadığından bu tetikleyici
-- yalnızca oturumlu kullanıcıları kapsar.
create or replace function public.enforce_logs_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
begin
  if new.user_id is not null then
    select count(*) into recent_count
    from public.logs
    where user_id = new.user_id
      and created_at > now() - interval '1 minute';

    if recent_count >= 30 then
      raise exception 'log rate limit exceeded for user %', new.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists logs_rate_limit_trigger on public.logs;
create trigger logs_rate_limit_trigger
  before insert on public.logs
  for each row execute function public.enforce_logs_rate_limit();

-- =====================================================================
-- 6) user_quotas — AI Koç'un günlük hak sayacı (SUNUCU TARAFI — GÜVENLİ)
--    localStorage tabanlı sayaç tamamen kaldırıldı (kullanıcı DevTools'tan
--    localStorage.clear() ile hakkını sıfırlayabiliyordu). Artık sayaç
--    burada tutulur ve YALNIZCA api/coach-action.js (service_role) yazabilir;
--    istemci (anon key) yalnızca kendi satırını OKUYABİLİR, hiçbir insert/
--    update/delete policy'si tanımlı değil — service_role RLS'i zaten
--    bypass eder, bu yüzden istemcinin buraya yazma yolu yoktur.
-- =====================================================================
create table if not exists public.user_quotas (
  user_id         uuid not null references auth.users (id) on delete cascade,
  date            date not null default current_date,
  remaining_usage int not null default 3,
  updated_at      timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.user_quotas enable row level security;

create policy "user_quotas_select_own" on public.user_quotas
  for select using (auth.uid() = user_id);
-- Bilerek YOK: insert/update/delete policy'si. Yalnızca service_role yazabilir.

-- Atomik düşüm: eşzamanlı iki istek aynı anda gelirse (yarış durumu) bile
-- hakkın 0'ın altına inmemesini ve iki kez düşmemesini garanti eder — tek bir
-- INSERT ... ON CONFLICT ... DO UPDATE ifadesi Postgres'te satır kilidiyle
-- atomik çalışır. security definer sayesinde RLS'i güvenle bypass eder;
-- yalnızca service_role çalıştırabilir (aşağıdaki revoke/grant).
create or replace function public.decrement_user_quota(p_user_id uuid, p_date date, p_default_limit int default 3)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
begin
  insert into public.user_quotas (user_id, date, remaining_usage)
  values (p_user_id, p_date, greatest(p_default_limit - 1, 0))
  on conflict (user_id, date)
  do update set remaining_usage = greatest(public.user_quotas.remaining_usage - 1, 0),
                updated_at = now()
  returning remaining_usage into v_remaining;

  return v_remaining;
end;
$$;

revoke all on function public.decrement_user_quota(uuid, date, int) from public;
grant execute on function public.decrement_user_quota(uuid, date, int) to service_role;
