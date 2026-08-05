-- =====================================================================
-- Görev sürükle-bırak sıralaması — tasks.sort_order
-- Supabase SQL Editor'e yapıştırıp "Run" ile çalıştır. Güvenle tekrar
-- çalıştırılabilir (idempotent) — TEK bir nullable sütun ekler, mevcut
-- veriye hiç dokunmaz.
--
-- NEDEN GEREKLİ: ManualPlanBuilder.jsx'e eklenen sürükle-bırak sıralama
-- ÖNCEDEN yalnızca builder'ın kendi yerel (henüz kaydedilmemiş) state'inde
-- anlamlıydı — kaydedip planı yeniden açtığında (fetchPlanDetail/
-- fetchDashboardData) tasks.* hiçbir sıraya göre ÇEKİLMİYORDU (yalnızca
-- week_number'a göre), bu yüzden kullanıcının özenle sıraladığı görevler
-- sayfa yenilenince RASTGELE bir sıraya dönerdi — sessizce bozuk bir
-- özellik olurdu. Bu sütun + planService.js'teki ilgili sorgulara eklenen
-- ikincil `.order("sort_order")` bunu kalıcı hale getirir.
--
-- ESKİ (bu sütundan önce oluşturulmuş, AI tarafından üretilmiş) satırlarda
-- sort_order NULL kalır — `nullsFirst: false` ile bunlar sona düşer,
-- aralarındaki GÖRECELİ sıra etkilenmez (mevcut davranış korunur).
-- =====================================================================

alter table public.tasks add column if not exists sort_order int;

create index if not exists tasks_plan_day_sort_idx on public.tasks (plan_id, day_number, sort_order);

NOTIFY pgrst, 'reload schema';
