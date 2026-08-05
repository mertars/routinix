-- =====================================================================
-- Bozulmuş/artık (stale) görev temizliği — day_number > plans.total_days
-- olan satırları siler. Supabase SQL Editor'e yapıştırıp "Run" ile çalıştır.
--
-- NEDEN GEREKLİ: "planı N güne indir" isteği (AI Koç) her zaman AI'ın
-- deltasına (mutations/deletedTaskIds) güveniyordu — model bir görevi ne
-- yeniden dağıtırsa ne silerse (ör. çok görevli bir yanıt token sınırında
-- kesilirse), o görev day_number > yeni total_days ile DB'de ARTIK kalabilir.
-- PlanBoard.jsx'in takvim şeridi bunu (total_days kadar hücre ürettiği için)
-- gizler, AMA "Tüm Plan" PDF ihracı (PrintablePlan.jsx, `weeks` state'inin
-- TAMAMINI kullanıyordu) bu artık günleri de basıyordu — bir kullanıcının
-- "7 günlük plan 5 güne indi ama PDF 11 gün gösteriyor" şeklinde
-- gözlemlediği tam olarak buydu.
--
-- KALICI DÜZELTME kod tarafında yapıldı (api/_lib/planDelta.js —
-- pruneTasksBeyondTotalDays — artık her total_days değişiminde bu
-- değişmezi DB seviyesinde otomatik zorluyor) VE PrintablePlan.jsx artık
-- ayrıca plan.total_days ile sınırlıyor (iki katmanlı savunma). BU SCRIPT
-- yalnızca BU DÜZELTMEDEN ÖNCE ZATEN bozulmuş olan mevcut satırları
-- geriye dönük temizler — tek seferlik, güvenle tekrar çalıştırılabilir
-- (idempotent: ikinci çalıştırmada silinecek satır kalmaz).
--
-- GÜVENLİ: yalnızca total_days DOLU olan planları etkiler (NULL total_days
-- — ör. çok eski planlar — dokunulmadan bırakılır, "sınırsız" kabul edilir).
-- =====================================================================

-- Önce KAÇ satırın etkileneceğini gör (silme YOK, yalnızca SELECT):
-- select t.id, t.plan_id, t.day_number, p.total_days, p.title
-- from public.tasks t
-- join public.plans p on p.id = t.plan_id
-- where p.total_days is not null and t.day_number > p.total_days
-- order by p.id, t.day_number;

delete from public.tasks t
using public.plans p
where t.plan_id = p.id
  and p.total_days is not null
  and t.day_number > p.total_days;
