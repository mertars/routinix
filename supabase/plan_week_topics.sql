-- =====================================================================
-- AI Plan Üretimi — Haftalık İskelet (week_topics)
-- Supabase SQL Editor'e yapıştırıp "Run" ile çalıştır. Güvenle tekrar
-- çalıştırılabilir — TEK bir nullable sütun ekler, mevcut plans/routines/
-- tasks verisine hiç dokunmaz. Eski (bu sütun eklenmeden önce oluşmuş)
-- planlarda NULL kalır — kod tarafı bunu zaten güvenle ele alıyor
-- (bkz. usePlanStudio.js loadNextWeek), eski planlar eskisi gibi çalışmaya
-- devam eder.
-- =====================================================================

alter table public.plans add column if not exists week_topics jsonb;
