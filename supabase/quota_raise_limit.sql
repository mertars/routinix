-- =====================================================================
-- AI Koç günlük hakkı: 3 → 100
-- Supabase SQL Editor'e yapıştırıp "Run" ile çalıştır. Güvenle tekrar
-- çalıştırılabilir.
--
-- 1) decrement_user_quota fonksiyonunun kendi varsayılanını da 100 yapar
--    (api/_lib/quota.js zaten p_default_limit'i açıkça 100 olarak
--    gönderiyor, ama SQL tarafındaki varsayılanı da güncel tutmak
--    ileride tek kaynağın şaşmaması için).
-- 2) BUGÜN zaten 0'a düşmüş satırları sıfırlar — aksi halde limiti
--    yükseltmek yalnızca YENİ satırları etkiler, bugün zaten kotası
--    dolmuş hesaplar "kota doldu" hatasını görmeye devam eder.
-- =====================================================================

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

-- Bugün zaten oluşmuş satırları yeni limitle güncelle (halihazırda 0'a
-- düşmüş hesapları anında kurtarır). Yalnızca BUGÜNÜN tarihini etkiler,
-- geçmiş günlerin kayıtlarına dokunmaz.
update public.user_quotas
set remaining_usage = 100, updated_at = now()
where date = current_date;
