-- =====================================================================
-- AI Koç — ÖMÜR BOYU deneme hakkı (20 mesaj), günlük sıfırlanan eski
-- user_quotas sisteminin YERİNE. Supabase SQL Editor'e yapıştırıp "Run"
-- ile çalıştır. Güvenle tekrar çalıştırılabilir (idempotent).
--
-- NEDEN YENİ TABLO: user_quotas (user_id, date) birleşik anahtarlıydı —
-- her gün YENİ bir satır oluşuyordu (kasıtlı olarak, "günlük hak" için).
-- Artık gerçek bir freemium "deneme" modeli isteniyor: kullanıcı başına
-- TOPLAM 20 mesaj, hiç sıfırlanmaz. Bunu user_quotas üzerinde date'i
-- yoksayarak simüle etmek yerine (satırlar birikip karmaşıklaşırdı),
-- (user_id) TEK anahtarlı ayrı, sade bir tablo daha doğru.
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
-- Bilerek YOK: insert/update/delete policy'si — user_quotas ile AYNI
-- güvenlik deseni, yalnızca service_role (api/coach-action.js) yazabilir.

-- Atomik artış — eşzamanlı iki istek aynı anda gelse bile sayacın iki kez
-- artmamasını/limitin üstüne çıkmamasını garanti eder (user_quotas'taki
-- decrement_user_quota ile AYNI teknik: INSERT ... ON CONFLICT ... DO UPDATE).
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
