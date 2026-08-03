-- =====================================================================
-- Routinix Nexus — Okunabilir Link Slug'ları
-- Supabase SQL Editor'e yapıştırıp "Run" ile çalıştır. Güvenle tekrar
-- çalıştırılabilir (idempotent) — yalnızca `templates` tablosuna EKLEME
-- yapar, plans/routines/tasks/community şemasına dokunmaz.
--
-- NE YAPAR:
--   1) `templates.slug` — opsiyonel (NULL olabilir), yalnızca DOLU
--      değerler için benzersizliği zorunlu kılan KISMİ (partial) bir unique
--      index ile korunur (`where slug is not null`) — bu sayede henüz slug'ı
--      hesaplanmamış/eski satırlar (hepsi NULL) birbiriyle "unique" ihlali
--      YAŞAMAZ, yalnızca GERÇEKTEN dolu iki slug aynı olursa hata verir.
--   2) 16 seed şablonuna (bkz. seed_nexus_data.sql) GERİYE DÖNÜK slug
--      atanır — client'taki `slugify()` (src/utils/slugify.js) ile BİREBİR
--      aynı algoritmanın elle hesaplanmış çıktısı, tutarlılık için.
-- =====================================================================

alter table public.templates add column if not exists slug text;

create unique index if not exists templates_slug_unique_idx
  on public.templates (slug)
  where slug is not null;

update public.templates set slug = '14-gunluk-derin-odak-mimarisi' where id = '10000000-0000-0000-0000-000000000001' and slug is null;
update public.templates set slug = '21-gunluk-surdurulebilir-beslenme' where id = '10000000-0000-0000-0000-000000000002' and slug is null;
update public.templates set slug = '30-gunluk-push-pull-legs' where id = '10000000-0000-0000-0000-000000000003' and slug is null;
update public.templates set slug = '45-gunluk-yks-sprint-programi' where id = '10000000-0000-0000-0000-000000000004' and slug is null;
update public.templates set slug = '10-gunluk-dijital-minimalizm-detoksu' where id = '10000000-0000-0000-0000-000000000005' and slug is null;
update public.templates set slug = 'full-stack-senior-olma-rutini' where id = '10000000-0000-0000-0000-000000000006' and slug is null;
update public.templates set slug = 'gece-kodu-derin-fokus-plani' where id = '10000000-0000-0000-0000-000000000007' and slug is null;
update public.templates set slug = 'derece-ogrencisinin-12-saatlik-calisma-blogu' where id = '10000000-0000-0000-0000-000000000008' and slug is null;
update public.templates set slug = 'tyt-net-artirma-kampi' where id = '10000000-0000-0000-0000-000000000009' and slug is null;
update public.templates set slug = 'intermittent-fasting-10k-adim' where id = '10000000-0000-0000-0000-000000000010' and slug is null;
update public.templates set slug = 'siki-yag-yakim-definasyon' where id = '10000000-0000-0000-0000-000000000011' and slug is null;
update public.templates set slug = 'sabah-05-00-kulubu-minimalist-yasam' where id = '10000000-0000-0000-0000-000000000012' and slug is null;
update public.templates set slug = 'docker-kubernetes-atolye-serisi' where id = '10000000-0000-0000-0000-000000000013' and slug is null;
update public.templates set slug = 'butce-dostu-7-gunluk-kapadokya-ege-rotasi' where id = '10000000-0000-0000-0000-000000000014' and slug is null;
update public.templates set slug = '30-gunde-akici-ingilizce-konusma-sprinti' where id = '10000000-0000-0000-0000-000000000015' and slug is null;
update public.templates set slug = 'aile-icin-surdurulebilir-menu-planlama' where id = '10000000-0000-0000-0000-000000000016' and slug is null;
