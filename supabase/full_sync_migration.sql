-- =====================================================================
-- Routinix — TAM ŞEMA SENKRONİZASYONU (full_sync_migration.sql)
--
-- Bu tek dosya, bugüne kadar supabase/ klasörüne AYRI AYRI eklenmiş
-- migration dosyalarının (migration.sql, plan_week_topics.sql,
-- nexus_link_sharing.sql, nexus_readable_slugs.sql,
-- plan_rate_limit.sql, ai_trial_limit.sql, quota_raise_limit.sql) TOPLAMINI,
-- kod tabanının (src/ + api/) GERÇEKTE okuduğu/yazdığı her tablo+sütunla
-- karşılaştırarak, TEK SEFERDE ve GÜVENLE çalıştırılabilecek şekilde
-- birleştirir.
--
-- GÜVENLİ / YIKICI DEĞİL:
--   • Hiçbir DROP TABLE içermez (migration.sql'in başındaki eski
--     "sıfırdan kurulum" DROP'ları BİLEREK burada YOK — mevcut verini siler).
--   • Her adım CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
--     CREATE INDEX IF NOT EXISTS / CREATE OR REPLACE ile yazıldı — kaç kez
--     çalıştırırsan çalıştır, zaten uygulanmış kısımlar no-op'tur.
--   • Zaten bu migration'ların BİR KISMINI çalıştırmış olsan bile (hangi
--     alt kümesini çalıştırdığını hatırlamasan bile) sorun değil — script
--     yalnızca EKSİK olanı tamamlar.
--
-- NEDEN GEREKLİ: Bu oturumda birkaç kez ("templates.slug does not exist",
-- FUNCTION_INVOCATION_FAILED → api_request_log yok) tam olarak bu senaryu
-- yaşandı — kod yeni bir sütun/tablo bekliyordu ama ilgili tekil migration
-- dosyası Supabase projesinde hiç çalıştırılmamıştı. Bu dosya, hepsini TEK
-- yerde toplayıp bu sınıf hatayı kalıcı olarak ortadan kaldırmak için var.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1) plans
-- =====================================================================
create table if not exists public.plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  summary    text,
  mode       text not null default 'general'
             check (mode in ('software', 'fitness', 'vacation', 'general')),
  total_days int,
  created_at timestamptz not null default now()
);

-- src/services/planService.js savePlanToSupabase() ve src/usePlanStudio.js
-- loadNextWeek() — plana ait haftalık iskelet (bkz. plan_week_topics.sql).
alter table public.plans add column if not exists week_topics jsonb;

create index if not exists plans_user_id_idx on public.plans (user_id);
create index if not exists plans_created_at_idx on public.plans (created_at desc);

alter table public.plans enable row level security;

drop policy if exists "plans_select_own" on public.plans;
create policy "plans_select_own" on public.plans
  for select using (auth.uid() = user_id);
drop policy if exists "plans_insert_own" on public.plans;
create policy "plans_insert_own" on public.plans
  for insert with check (auth.uid() = user_id);
drop policy if exists "plans_update_own" on public.plans;
create policy "plans_update_own" on public.plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "plans_delete_own" on public.plans;
create policy "plans_delete_own" on public.plans
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- 2) routines
-- =====================================================================
create table if not exists public.routines (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.plans (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  content    text not null,
  frequency  text not null default 'weekly',
  created_at timestamptz not null default now()
);

create index if not exists routines_plan_id_idx on public.routines (plan_id);
create index if not exists routines_user_id_idx on public.routines (user_id);

alter table public.routines enable row level security;

drop policy if exists "routines_select_own" on public.routines;
create policy "routines_select_own" on public.routines
  for select using (auth.uid() = user_id);
drop policy if exists "routines_insert_own" on public.routines;
create policy "routines_insert_own" on public.routines
  for insert with check (auth.uid() = user_id);
drop policy if exists "routines_update_own" on public.routines;
create policy "routines_update_own" on public.routines
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "routines_delete_own" on public.routines;
create policy "routines_delete_own" on public.routines
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- 3) tasks
-- =====================================================================
create table if not exists public.tasks (
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

-- Eski kurulumlarda bu sütunlar sonradan eklenmiş olabilir — no-op eğer zaten varsa.
alter table public.tasks add column if not exists duration_min int;
alter table public.tasks add column if not exists priority text;
alter table public.tasks add column if not exists estimated_cost text;
alter table public.tasks add column if not exists map_search_query text;
-- ManualPlanBuilder.jsx sürükle-bırak sıralaması (bkz. task_sort_order.sql).
alter table public.tasks add column if not exists sort_order int;

create index if not exists tasks_plan_id_idx on public.tasks (plan_id);
create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists tasks_plan_week_idx on public.tasks (plan_id, week_number, day_number);
create index if not exists tasks_plan_day_sort_idx on public.tasks (plan_id, day_number, sort_order);

alter table public.tasks enable row level security;

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);
drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);
drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Bilerek YOK: "tasks_delete_own" policy'si — toplu client-side silme kapalı.

-- Kolon bazlı yetki daraltma: authenticated rolü UPDATE ile yalnızca
-- is_completed kolonuna dokunabilir (duration_min/priority/day_number/title
-- gibi "yüksek yetkili" alanlar yalnızca api/coach-action.js, service_role
-- ile değiştirilebilir).
revoke update on public.tasks from authenticated;
grant update (is_completed) on public.tasks to authenticated;

-- =====================================================================
-- 4) logs
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

drop policy if exists "logs_insert_own_or_anon" on public.logs;
create policy "logs_insert_own_or_anon" on public.logs
  for insert with check (user_id is null or auth.uid() = user_id);
drop policy if exists "logs_select_own" on public.logs;
create policy "logs_select_own" on public.logs
  for select using (auth.uid() = user_id);

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
-- 5) user_quotas — ESKİ günlük sayaç. user_ai_trial (bölüm 12) onun
--    YERİNİ aldı ama tablo/fonksiyon geriye dönük uyumluluk için kalır.
-- =====================================================================
create table if not exists public.user_quotas (
  user_id         uuid not null references auth.users (id) on delete cascade,
  date            date not null default current_date,
  remaining_usage int not null default 3,
  updated_at      timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.user_quotas enable row level security;

drop policy if exists "user_quotas_select_own" on public.user_quotas;
create policy "user_quotas_select_own" on public.user_quotas
  for select using (auth.uid() = user_id);

create or replace function public.decrement_user_quota(p_user_id uuid, p_date date, p_default_limit int default 100)
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

-- =====================================================================
-- 6) focus_sessions
-- =====================================================================
create table if not exists public.focus_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  task_id      uuid references public.tasks (id) on delete set null,
  plan_id      uuid references public.plans (id) on delete set null,
  started_at   timestamptz not null,
  ended_at     timestamptz not null,
  duration_min int not null check (duration_min > 0),
  created_at   timestamptz not null default now()
);

create index if not exists focus_sessions_user_id_idx on public.focus_sessions (user_id);
create index if not exists focus_sessions_started_at_idx on public.focus_sessions (started_at desc);
create index if not exists focus_sessions_plan_id_idx on public.focus_sessions (plan_id);

alter table public.focus_sessions enable row level security;

drop policy if exists "focus_sessions_select_own" on public.focus_sessions;
create policy "focus_sessions_select_own" on public.focus_sessions
  for select using (auth.uid() = user_id);
drop policy if exists "focus_sessions_insert_own" on public.focus_sessions;
create policy "focus_sessions_insert_own" on public.focus_sessions
  for insert with check (auth.uid() = user_id);

-- =====================================================================
-- 7) daily_reports
-- =====================================================================
create table if not exists public.daily_reports (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  report_date       date not null default current_date,
  summary_text      text not null,
  tomorrow_focus    jsonb not null default '[]'::jsonb,
  stats             jsonb not null default '{}'::jsonb,
  rescheduled_count int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, report_date)
);

create index if not exists daily_reports_user_id_idx on public.daily_reports (user_id);
create index if not exists daily_reports_report_date_idx on public.daily_reports (report_date desc);

alter table public.daily_reports enable row level security;

drop policy if exists "daily_reports_select_own" on public.daily_reports;
create policy "daily_reports_select_own" on public.daily_reports
  for select using (auth.uid() = user_id);

-- =====================================================================
-- 8) community_profiles
-- =====================================================================
create table if not exists public.community_profiles (
  id               uuid primary key default gen_random_uuid(),
  auth_user_id     uuid unique references auth.users (id) on delete cascade,
  username         text not null unique,
  display_name     text,
  avatar_url       text,
  bio              text,
  usage_days_count int not null default 0,
  is_bot           boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint community_profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint community_profiles_real_user_requires_auth check (is_bot or auth_user_id is not null)
);

create index if not exists community_profiles_username_idx on public.community_profiles (username);
create index if not exists community_profiles_auth_user_id_idx on public.community_profiles (auth_user_id);

alter table public.community_profiles enable row level security;

drop policy if exists "community_profiles_select_all" on public.community_profiles;
create policy "community_profiles_select_all" on public.community_profiles
  for select using (true);
drop policy if exists "community_profiles_insert_own" on public.community_profiles;
create policy "community_profiles_insert_own" on public.community_profiles
  for insert with check (auth_user_id = auth.uid());
drop policy if exists "community_profiles_update_own" on public.community_profiles;
create policy "community_profiles_update_own" on public.community_profiles
  for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id from public.community_profiles where auth_user_id = auth.uid();
$$;

-- =====================================================================
-- 9) user_follows
-- =====================================================================
create table if not exists public.user_follows (
  follower_id  uuid not null references public.community_profiles (id) on delete cascade,
  following_id uuid not null references public.community_profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists user_follows_follower_idx on public.user_follows (follower_id);
create index if not exists user_follows_following_idx on public.user_follows (following_id);

alter table public.user_follows enable row level security;

drop policy if exists "user_follows_select_all" on public.user_follows;
create policy "user_follows_select_all" on public.user_follows
  for select using (true);
drop policy if exists "user_follows_insert_own" on public.user_follows;
create policy "user_follows_insert_own" on public.user_follows
  for insert with check (follower_id = public.current_profile_id());
drop policy if exists "user_follows_delete_own" on public.user_follows;
create policy "user_follows_delete_own" on public.user_follows
  for delete using (follower_id = public.current_profile_id());

-- =====================================================================
-- 10) templates
-- =====================================================================
create table if not exists public.templates (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references public.community_profiles (id) on delete cascade,
  title             text not null,
  category          text not null check (category in ('software', 'fitness', 'vacation', 'general')),
  cover_url         text,
  goal              text not null,
  total_days        int not null default 7 check (total_days > 0 and total_days <= 365),
  tags              text[] not null default '{}',
  story_impact      text,
  story_process     text,
  story_pros_cons   text,
  story_tips        text,
  story_markdown    text not null default '',
  preview_routines  jsonb not null default '[]'::jsonb,
  template_tasks    jsonb not null default '[]'::jsonb,
  is_seed           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- src/services/communityService.js cloneTemplateToMyPlans/createTemplate.
alter table public.templates add column if not exists template_tasks jsonb not null default '[]'::jsonb;
-- Routinix Nexus link paylaşımı — görüntülenme sayacı (nexus_link_sharing.sql).
alter table public.templates add column if not exists view_count int not null default 0;
-- Routinix Nexus okunabilir link slug'ı (nexus_readable_slugs.sql) —
-- src/components/SharedTemplateView.jsx ve fetchTemplateByIdOrSlug() bunu okur.
alter table public.templates add column if not exists slug text;

create index if not exists templates_author_id_idx on public.templates (author_id);
create index if not exists templates_category_idx on public.templates (category);
create index if not exists templates_created_at_idx on public.templates (created_at desc);
create index if not exists templates_tags_gin_idx on public.templates using gin (tags);
create index if not exists templates_view_count_idx on public.templates (view_count desc);
create unique index if not exists templates_slug_unique_idx
  on public.templates (slug)
  where slug is not null;

alter table public.templates enable row level security;

drop policy if exists "templates_select_all" on public.templates;
create policy "templates_select_all" on public.templates
  for select using (true);
drop policy if exists "templates_insert_own" on public.templates;
create policy "templates_insert_own" on public.templates
  for insert with check (author_id = public.current_profile_id());
drop policy if exists "templates_update_own" on public.templates;
create policy "templates_update_own" on public.templates
  for update using (author_id = public.current_profile_id()) with check (author_id = public.current_profile_id());
drop policy if exists "templates_delete_own" on public.templates;
create policy "templates_delete_own" on public.templates
  for delete using (author_id = public.current_profile_id());

-- Anon (misafir) ziyaretçiler dahil, yalnızca view_count'u 1 artıran dar
-- yüzeyli RPC — src/services/communityService.js incrementTemplateView().
create or replace function public.increment_template_view(p_template_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.templates set view_count = view_count + 1 where id = p_template_id;
$$;

revoke all on function public.increment_template_view(uuid) from public;
grant execute on function public.increment_template_view(uuid) to anon, authenticated;

-- =====================================================================
-- 11) template_likes / template_clones / template_comments / template_comment_replies
-- =====================================================================
create table if not exists public.template_likes (
  template_id uuid not null references public.templates (id) on delete cascade,
  user_id     uuid not null references public.community_profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (template_id, user_id)
);

create index if not exists template_likes_template_idx on public.template_likes (template_id);
create index if not exists template_likes_user_idx on public.template_likes (user_id);

alter table public.template_likes enable row level security;

drop policy if exists "template_likes_select_all" on public.template_likes;
create policy "template_likes_select_all" on public.template_likes
  for select using (true);
drop policy if exists "template_likes_insert_own" on public.template_likes;
create policy "template_likes_insert_own" on public.template_likes
  for insert with check (user_id = public.current_profile_id());
drop policy if exists "template_likes_delete_own" on public.template_likes;
create policy "template_likes_delete_own" on public.template_likes
  for delete using (user_id = public.current_profile_id());

create table if not exists public.template_clones (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references public.templates (id) on delete cascade,
  user_id        uuid not null references public.community_profiles (id) on delete cascade,
  cloned_plan_id uuid references public.plans (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists template_clones_template_idx on public.template_clones (template_id);
create index if not exists template_clones_user_idx on public.template_clones (user_id);

alter table public.template_clones enable row level security;

drop policy if exists "template_clones_select_all" on public.template_clones;
create policy "template_clones_select_all" on public.template_clones
  for select using (true);
drop policy if exists "template_clones_insert_own" on public.template_clones;
create policy "template_clones_insert_own" on public.template_clones
  for insert with check (user_id = public.current_profile_id());

create table if not exists public.template_comments (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references public.templates (id) on delete cascade,
  user_id               uuid not null references public.community_profiles (id) on delete cascade,
  content               text not null check (char_length(content) between 1 and 1000),
  usage_days_at_comment int not null default 0,
  created_at            timestamptz not null default now()
);

create index if not exists template_comments_template_idx on public.template_comments (template_id, created_at desc);
create index if not exists template_comments_user_idx on public.template_comments (user_id);

alter table public.template_comments enable row level security;

drop policy if exists "template_comments_select_all" on public.template_comments;
create policy "template_comments_select_all" on public.template_comments
  for select using (true);
drop policy if exists "template_comments_insert_own" on public.template_comments;
create policy "template_comments_insert_own" on public.template_comments
  for insert with check (user_id = public.current_profile_id());
drop policy if exists "template_comments_delete_own" on public.template_comments;
create policy "template_comments_delete_own" on public.template_comments
  for delete using (user_id = public.current_profile_id());

create table if not exists public.template_comment_replies (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.template_comments (id) on delete cascade,
  author_id  uuid not null references public.community_profiles (id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists template_comment_replies_comment_idx on public.template_comment_replies (comment_id);

alter table public.template_comment_replies enable row level security;

drop policy if exists "template_comment_replies_select_all" on public.template_comment_replies;
create policy "template_comment_replies_select_all" on public.template_comment_replies
  for select using (true);
drop policy if exists "template_comment_replies_insert_author_only" on public.template_comment_replies;
create policy "template_comment_replies_insert_author_only" on public.template_comment_replies
  for insert with check (
    author_id = public.current_profile_id()
    and exists (
      select 1 from public.template_comments c
      join public.templates t on t.id = c.template_id
      where c.id = comment_id and t.author_id = public.current_profile_id()
    )
  );
drop policy if exists "template_comment_replies_delete_own" on public.template_comment_replies;
create policy "template_comment_replies_delete_own" on public.template_comment_replies
  for delete using (author_id = public.current_profile_id());

-- =====================================================================
-- 12) user_ai_trial — AI Koç ömür boyu deneme hakkı (ai_trial_limit.sql)
--     src/services/AiCoachWidget.jsx / api/_lib/quota.js bunu kullanır.
-- =====================================================================
create table if not exists public.user_ai_trial (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  messages_used int not null default 0,
  updated_at    timestamptz not null default now()
);

alter table public.user_ai_trial enable row level security;

drop policy if exists "user_ai_trial_select_own" on public.user_ai_trial;
create policy "user_ai_trial_select_own" on public.user_ai_trial
  for select using (auth.uid() = user_id);

create or replace function public.increment_user_trial_usage(p_user_id uuid, p_trial_limit int default 20)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  insert into public.user_ai_trial (user_id, messages_used)
  values (p_user_id, 1)
  on conflict (user_id)
  do update set messages_used = least(public.user_ai_trial.messages_used + 1, p_trial_limit),
                updated_at = now()
  returning messages_used into v_used;

  return v_used;
end;
$$;

revoke all on function public.increment_user_trial_usage(uuid, int) from public;
grant execute on function public.increment_user_trial_usage(uuid, int) to service_role;

-- =====================================================================
-- 13) api_request_log — Planla butonu RPM/RPH/RPD/Global Tavan
--     (plan_rate_limit.sql) — api/_lib/planRateLimit.js bunu kullanır.
-- =====================================================================
create table if not exists public.api_request_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null default 'generate-plan',
  created_at timestamptz not null default now()
);

create index if not exists api_request_log_user_created_idx on public.api_request_log (user_id, created_at desc);
create index if not exists api_request_log_created_idx on public.api_request_log (created_at desc);

alter table public.api_request_log enable row level security;

drop policy if exists "api_request_log_select_own" on public.api_request_log;
create policy "api_request_log_select_own" on public.api_request_log
  for select using (auth.uid() = user_id);

-- =====================================================================
-- 14) Aktif plan sayısı SINIRSIZ — önceki bir sürümde burada 10 planlık bir
--     BEFORE INSERT trigger'ı (enforce_plan_limit) vardı; ürün kararıyla
--     tamamen kaldırıldı. Bu script o trigger'ı BİLEREK oluşturmaz VE zaten
--     kurulu bir projede duruyorsa aşağıda kendisi kaldırır — ayrı bir
--     dosya çalıştırmana gerek yok.
-- =====================================================================
drop trigger if exists plans_enforce_limit on public.plans;
drop function if exists public.enforce_plan_limit();

-- =====================================================================
-- 15) İstatistik view'leri — src/services/communityService.js +
--     profileService.js bunları okur (template_stats/profile_stats).
-- =====================================================================
create or replace view public.template_stats as
select
  t.id as template_id,
  t.author_id,
  coalesce(l.like_count, 0) as like_count,
  coalesce(c.clone_count, 0) as clone_count,
  coalesce(cm.comment_count, 0) as comment_count
from public.templates t
left join (select template_id, count(*) as like_count from public.template_likes group by template_id) l on l.template_id = t.id
left join (select template_id, count(*) as clone_count from public.template_clones group by template_id) c on c.template_id = t.id
left join (select template_id, count(*) as comment_count from public.template_comments group by template_id) cm on cm.template_id = t.id;

create or replace view public.profile_stats as
select
  p.id as profile_id,
  coalesce(sum(ts.like_count), 0) as total_likes,
  coalesce(sum(ts.clone_count), 0) as total_clones,
  coalesce(sum(ts.comment_count), 0) as total_comments,
  (select count(*) from public.templates where author_id = p.id) as template_count,
  (select count(*) from public.user_follows where following_id = p.id) as follower_count,
  (select count(*) from public.user_follows where follower_id = p.id) as following_count
from public.community_profiles p
left join public.template_stats ts on ts.author_id = p.id
group by p.id;

grant select on public.template_stats to anon, authenticated;
grant select on public.profile_stats to anon, authenticated;

-- =====================================================================
-- 16) PostgREST şema önbelleğini yenile — yeni sütun/tablo/fonksiyonların
--     REST API'de ANINDA görünür olması için (aksi halde önbellek süresi
--     dolana kadar "column does not exist" hataları görülebilir).
-- =====================================================================
NOTIFY pgrst, 'reload schema';
