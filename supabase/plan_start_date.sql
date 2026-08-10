-- Dinamik Gün/Tarih Bağlama Sistemi (bkz. src/utils/planDate.js,
-- src/usePlanDate.js) — planın gerçek takvim başlangıcı. `tasks.day_number`
-- HÂLÂ 1'den başlayan ardışık bir sıra numarasıdır (değişmedi); start_date bu
-- sıra numarasını GERÇEK bir takvim tarihine bağlamak için AYRI bir alan.
--
-- Var olan planlar için "bugün" değil, gerçek OLUŞTURULMA tarihi (created_at)
-- geriye dolduruluyor — aksi halde eski bir plan bu migration çalıştığı gün
-- "yeni başlamış" gibi görünür, N. gün hesabı yanlış kayardı.
alter table public.plans add column if not exists start_date date;
update public.plans set start_date = created_at::date where start_date is null;
alter table public.plans alter column start_date set default current_date;
alter table public.plans alter column start_date set not null;

NOTIFY pgrst, 'reload schema';
