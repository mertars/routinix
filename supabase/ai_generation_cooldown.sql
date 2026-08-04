-- =====================================================================
-- AI plan üretimi (api/generate-plan.js) için sunucu tarafı "soğuma süresi"
-- — GÜVENLİK AÇIĞI DÜZELTMESİ: bu uç noktanın (onboarding_questions/
-- create_plan/next_week — hepsi GERÇEK, ücretli Gemini çağrısı yapar)
-- ÖNCESİNDE hiçbir hak/hız sınırı YOKTU. AI Koç'un aksine (user_ai_trial,
-- 20 mesaj ömür boyu), plan üretimi sık kullanılması BEKLENEN, meşru bir
-- akış olduğu için burada bir "hak" sayacı YERİNE yalnızca "çok hızlı art
-- arda istek" engellenir (bkz. api/_lib/rateLimit.js) — bir istemcinin bu
-- uç noktayı script ile döngüde çağırıp sınırsız/ücretsiz Gemini isteği
-- tetiklemesini önler, normal kullanım hızında görünmez.
-- =====================================================================

create table if not exists public.user_ai_cooldown (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  last_call_at timestamptz not null default now()
);

alter table public.user_ai_cooldown enable row level security;

drop policy if exists "user_ai_cooldown_select_own" on public.user_ai_cooldown;
create policy "user_ai_cooldown_select_own" on public.user_ai_cooldown
  for select using (auth.uid() = user_id);
-- Bilerek YOK: insert/update/delete policy'si. Yalnızca service_role (bkz.
-- api/_lib/rateLimit.js) yazabilir.
