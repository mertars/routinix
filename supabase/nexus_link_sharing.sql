-- =====================================================================
-- Routinix Nexus — Link Paylaşımı & Görüntülenme Sayacı
-- Supabase SQL Editor'e yapıştırıp "Run" ile çalıştır. Güvenli şekilde
-- tekrar çalıştırılabilir (idempotent) — plans/routines/tasks/community
-- şemasına dokunmaz, yalnızca `templates` tablosuna EKLEME yapar.
--
-- NE YAPAR:
--   1) `templates.view_count` — paylaşım linkine tıklanan her görüntülenmede
--      1 artan DÜZ bir sayaç. `template_likes/clones/comments` GİBİ satır
--      bazlı bir olay tablosu OLARAK TASARLANMADI — görüntülenme, kimlik
--      gerektirmeyen (anonim ziyaretçiler dahil), çok yüksek frekanslı bir
--      olay; endüstri standardı da (ör. YouTube/Medium) bunun için satır
--      başına kimlik tutmak yerine düz bir sayaç kullanır.
--   2) `increment_template_view(template_id)` — SECURITY DEFINER bir RPC.
--      Yalnızca TEK bir sütunu (`view_count`) 1 artırır, başka HİÇBİR alanı
--      okuyamaz/değiştiremez — anon (oturumsuz/anonim) ziyaretçiler dahi
--      güvenle çağırabilir, RLS'i bypass etmesine rağmen yüzeyi bilinçli
--      olarak bu tek işleme daraltılmıştır.
-- =====================================================================

alter table public.templates add column if not exists view_count int not null default 0;

create index if not exists templates_view_count_idx on public.templates (view_count desc);

create or replace function public.increment_template_view(p_template_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.templates set view_count = view_count + 1 where id = p_template_id;
$$;

revoke all on function public.increment_template_view(uuid) from public;
grant execute on function public.increment_template_view(uuid) to anon, authenticated;
