-- =====================================================================
-- AI plan üretimi için çok katmanlı hız sınırlama (RPM/RPH/RPD + Global
-- Günlük Tavan) — api/_lib/planRateLimit.js tarafından kullanılır. Önceki
-- basit "3sn soğuma" (user_ai_cooldown/rateLimit.js) sistemini generate-plan.js
-- için KAPSAR/genişletir — o dosya hâlâ dursun, başka yerlerde tekrar
-- kullanılabilir, ama bu tablo generate-plan.js'in ASIL koruma katmanı olur.
--
-- TASARIM: her GERÇEK Gemini isteği (onboarding_questions/create_plan/
-- next_week) burada TEK bir satır olarak loglanır. RPM/RPH pencereleri
-- KAYAN pencere (rolling window — `created_at >= now() - interval`) ile,
-- RPD ve Global Tavan ise takvim günü (UTC) ile hesaplanır — projenin geri
-- kalanındaki `date` kolonlu tablolarla (user_quotas, daily_reports) AYNI
-- "günlük sıfırlama" mantığı.
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
-- Bilerek YOK: insert/update/delete policy'si. Yalnızca service_role
-- (bkz. api/_lib/planRateLimit.js) yazabilir.

-- İsteğe bağlı bakım: tabloyu sınırsız büyümekten korumak için 48 saatten
-- eski satırları temizler. RPD/Global Tavan yalnızca "bugün"e (UTC) baktığı
-- için 48 saat önceki veri hiçbir hesaplamada kullanılmaz — güvenle silinir.
-- Supabase'de bir pg_cron job'u olarak (ör. günde bir kez) planlanabilir;
-- şimdilik manuel çalıştırmak için burada bırakıldı.
-- select cron.schedule('cleanup_api_request_log', '0 3 * * *',
--   $$ delete from public.api_request_log where created_at < now() - interval '48 hours' $$);
