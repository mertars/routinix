-- =====================================================================
-- Widget Tabanlı Görev Sistemi — tasks.widgets
-- Supabase SQL Editor'e yapıştırıp "Run" ile çalıştır. Güvenle tekrar
-- çalıştırılabilir (idempotent) — TEK bir jsonb sütun ekler, mevcut
-- veriye hiç dokunmaz (varsayılan boş dizi).
--
-- NEDEN GEREKLİ: Planlama/Görev ekranı (PlanBoard.jsx/TaskCard.jsx)
-- artık her görevin kendi üzerine modüler "widget"lar (zaman aralığı,
-- kronometre, sayaç, kalori/makro, set-tekrar, Spotify/YouTube gömülü
-- oynatıcı, görsel, alt-liste, zorluk seviyesi, not) ekleyebildiği bir
-- yapıya kavuştu (bkz. src/utils/taskWidgets.js). Bu widget'ların HER
-- BİRİ tek bir görevin `widgets` jsonb dizisinde {id, type, value}
-- şeklinde saklanır.
--
-- GÜVENLİK NOTU (task_sort_order.sql/migration.sql İLE AYNI ilke):
-- tasks tablosunda `authenticated` rolü BİLEREK yalnızca belirli
-- sütunları doğrudan güncelleyebilir (title/detail/priority/duration_min
-- gibi PLAN YAPISI alanları yalnızca service_role ile, api/plan-edit.js
-- üzerinden değişebilir — bkz. migration.sql'deki revoke/grant bloğu).
-- `widgets`, is_completed İLE AYNI kategoriye girer: kullanıcının KENDİ
-- görevi üzerinde yaptığı, plan yapısını BOZMAYAN, anlık/etkileşimli bir
-- güncelleme (checkbox işaretlemekle aynı güven seviyesi) — bu yüzden
-- doğrudan istemciden (RLS `tasks_update_own`, auth.uid()=user_id ile
-- zaten kısıtlı) güncellenebilir kılınıyor; her widget değişikliği için
-- ayrı bir sunucu fonksiyonu turu GEREKMEZ. Postgres'te sütun bazlı
-- GRANT'lar EKLEYİCİDİR (additive) — bu, önceden verilmiş
-- `grant update (is_completed)`'i ETKİLEMEZ/SIFIRLAMAZ.
-- =====================================================================

alter table public.tasks add column if not exists widgets jsonb not null default '[]'::jsonb;

grant update (widgets) on public.tasks to authenticated;

NOTIFY pgrst, 'reload schema';
