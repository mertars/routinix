-- =====================================================================
-- Rutin sürükle-bırak sıralaması — routines.sort_order
-- Supabase SQL Editor'e yapıştırıp "Run" ile çalıştır. Güvenle tekrar
-- çalıştırılabilir (idempotent) — TEK bir nullable sütun ekler, mevcut
-- veriye hiç dokunmaz.
--
-- NEDEN GEREKLİ: Plan Studio & Editor Engine'deki Rutin Kartları
-- sürükle-bırak sıralanabilir (bkz. tasks.sort_order + task_sort_order.sql
-- ile AYNI gerekçe) — bu sütun/migration OLMADAN routines "created_at"a
-- göre sıralanır, ki toplu insert'te aynı transaction içindeki satırlar
-- AYNI now() değerini alabildiğinden kullanıcının sıraladığı düzen
-- KORUNMAZ.
-- =====================================================================

alter table public.routines add column if not exists sort_order int;

create index if not exists routines_plan_sort_idx on public.routines (plan_id, sort_order);

NOTIFY pgrst, 'reload schema';
