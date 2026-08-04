-- =====================================================================
-- 10 aktif plan limitini KALDIRIR (eski plan_limit.sql'in kurduğu
-- trigger'ın tersi — bu proje artık sınırsız plan oluşturmayı destekliyor).
-- Supabase SQL Editor'e yapıştırıp "Run" ile çalıştır. Güvenle tekrar
-- çalıştırılabilir (idempotent) — plans/routines/tasks verisine dokunmaz,
-- yalnızca plans tablosundaki BEFORE INSERT trigger'ını ve onu besleyen
-- fonksiyonu kaldırır. Bundan sonra kullanıcılar sınırsız plan oluşturabilir
-- (hem wizard hem Nexus şablon klonlama yolundan).
-- =====================================================================

drop trigger if exists plans_enforce_limit on public.plans;
drop function if exists public.enforce_plan_limit();

NOTIFY pgrst, 'reload schema';
