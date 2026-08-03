-- =====================================================================
-- Routinix Nexus — seed_nexus_data.sql (TEK TIKLA çalıştırılabilir)
--
-- Bu dosyayı Supabase SQL Editor'e YAPIŞTIRIP "Run" ile tek seferde
-- çalıştırabilirsin. GÜVENLİ:
--   • plans / routines / tasks tablolarına HİÇ DOKUNMAZ (DROP içermez)
--   • auth.users tablosuna hiçbir satır eklemez/değiştirmez
--   • gerçek kullanıcı verine (senin profiles/community_profiles
--     tablonda önceden var olan gerçek hesaplara) dokunmaz
--   • tamamen TEKRAR ÇALIŞTIRILABİLİR (idempotent) — sabit UUID'ler +
--     "on conflict ... do nothing" / "create ... if not exists" /
--     "create or replace" kullanır; ikinci kez çalıştırman hiçbir şeyi
--     çoğaltmaz veya bozmaz.
--
-- NE YAPAR:
--   1) Routinix Nexus şeması (community_profiles/templates/likes/clones/
--      comments/replies + istatistik view'leri + RLS) — muhtemelen zaten
--      kurulu, "if not exists" ile güvenle tekrar uygulanır.
--   2) 13 bot profili (10 orijinal + 3 yeni).
--   3) 16 zengin şablon (gerçek template_tasks/preview_routines JSON'ı,
--      hikaye alanları, etiketler, kapak görselleri).
--   4) Gerçek beğeni (72) + klon (12) satırları — sahte SAYAÇ değil,
--      template_stats view'inin okuduğu GERÇEK satırlar.
--   5) 19 yorum + 6 şablon-yazarı yanıtı, 16 şablonun TÜMÜNE dağıtılmış
--      (önceki sürümde yalnızca ilk 4 şablonun yorumu vardı).
--
-- Neden ekranda hiçbir şey görünmüyordu?
--   Bu SQL'in kendisinde hata YOKTU (RLS politikaları herkese açık okumaya
--   izin veriyor, bot/auth FK tasarımı zaten `auth_user_id` sütununu
--   NULLABLE tutarak bunu çözüyor) — sorun basitçe bu script'in Supabase
--   projende HİÇ ÇALIŞTIRILMAMIŞ olmasıydı. Aşağıdaki tek dosya artık
--   şema + veriyi TEK SEFERDE, standalone olarak kurar.
-- =====================================================================

-- =====================================================================
-- 9) profiles — "Topluluk Şablon Hub'ı" kullanıcı/bot kimliği. Bu tablo
--    yukarıdaki DROP bloğuna DAHİL DEĞİL.
--
--    TASARIM NOTU (auth_user_id ayrı bir sütun, `id` DEĞİL): Bot profilleri
--    (soğuk başlangıç/tohum içerik için) gerçek bir auth.users kaydı
--    OLMADAN var olabilmeli — Supabase auth.users'a doğrudan SQL insert
--    kırılgan/desteklenmeyen bir yoldur. Bu yüzden `profiles.id` KENDİ
--    başına bir kimlik (gen_random_uuid()), `auth_user_id` ise yalnızca
--    GERÇEK kullanıcılarda dolu olan, auth.users'a referans veren AYRI/
--    nullable bir sütun. Bot profillerinde auth_user_id NULL kalır —
--    login olamazlar, yalnızca topluluk içeriğinin "yazarı" olarak var
--    olurlar. `current_profile_id()` fonksiyonu (aşağıda), RLS policy'lerinde
--    "oturum açmış kullanıcının profili" karşılığını tek yerden çözer.
-- =====================================================================
create table if not exists public.community_profiles (
  id               uuid primary key default gen_random_uuid(),
  auth_user_id     uuid unique references auth.users (id) on delete cascade,
  username         text not null unique,
  display_name     text,
  avatar_url       text,
  bio              text,
  -- Gerçek kullanıcılarda bu sütun KULLANILMAZ — "Routinix'i kaç gündür
  -- kullanıyor" client'ta auth kullanıcısının GERÇEK created_at'inden
  -- anlık hesaplanır (bkz. src/services/profileService.js getUsageDays),
  -- her zaman doğru kalması ve ayrı bir güncelleme mekanizması gerekmemesi
  -- için. Bu sütun YALNIZCA bot profilleri için manuel seed edilen bir
  -- "sahte kıdem" değeridir (bkz. aşağıdaki SEED bloğu).
  usage_days_count int not null default 0,
  is_bot           boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint community_profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  -- Gerçek (bot olmayan) bir profilin GERÇEK bir auth kullanıcısına bağlı
  -- olması ZORUNLU; bot profillerde auth_user_id bilerek NULL'dır.
  constraint community_profiles_real_user_requires_auth check (is_bot or auth_user_id is not null)
);

create index if not exists community_profiles_username_idx on public.community_profiles (username);
create index if not exists community_profiles_auth_user_id_idx on public.community_profiles (auth_user_id);

alter table public.community_profiles enable row level security;

-- Profiller (Topluluk Hub'ının doğası gereği) HERKESE açık okunur.
drop policy if exists "community_profiles_select_all" on public.community_profiles;
create policy "community_profiles_select_all" on public.community_profiles
  for select using (true);
drop policy if exists "community_profiles_insert_own" on public.community_profiles;
create policy "community_profiles_insert_own" on public.community_profiles
  for insert with check (auth_user_id = auth.uid());
drop policy if exists "community_profiles_update_own" on public.community_profiles;
create policy "community_profiles_update_own" on public.community_profiles
  for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
-- Bilerek YOK: delete policy'si — profil silme, auth.users silinince
-- (on delete cascade) otomatik olur; ayrıca elle silme akışı YOK.

-- Oturum açmış kullanıcının kendi profil id'sini döner (yoksa NULL) — tüm
-- aşağıdaki RLS policy'leri "author_id/user_id = current_profile_id()"
-- şeklinde bunu kullanır; auth.uid() (bir auth.users id'si) ile profiles.id
-- (bağımsız bir uuid) birbirine KARIŞTIRILMASIN diye tek doğruluk kaynağı.
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id from public.community_profiles where auth_user_id = auth.uid();
$$;

-- =====================================================================
-- 10) user_follows — takip grafiği. Bu tablo yukarıdaki DROP bloğuna
--     DAHİL DEĞİL. Kendi kendini takip SQL SEVİYESİNDE de engellenir
--     (check constraint) — client tarafı kontrolü src/services/
--     profileService.js'te AYRICA yapılır (RLS tek gerçek sınır, client
--     kontrolü yalnızca UX nezaketi).
-- =====================================================================
create table if not exists public.user_follows (
  follower_id  uuid not null references public.community_profiles (id) on delete cascade,
  following_id uuid not null references public.community_profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists user_follows_follower_idx on public.user_follows (follower_id);
create index if not exists user_follows_following_idx on public.user_follows (following_id);

alter table public.user_follows enable row level security;

drop policy if exists "user_follows_select_all" on public.user_follows;
create policy "user_follows_select_all" on public.user_follows
  for select using (true);
drop policy if exists "user_follows_insert_own" on public.user_follows;
create policy "user_follows_insert_own" on public.user_follows
  for insert with check (follower_id = public.current_profile_id());
drop policy if exists "user_follows_delete_own" on public.user_follows;
create policy "user_follows_delete_own" on public.user_follows
  for delete using (follower_id = public.current_profile_id());

-- =====================================================================
-- 11) templates — Topluluk şablonları (TEMPLATE_LIBRARY'nin DB karşılığı;
--     src/constants.js'teki statik dizi hâlâ "resmi" hazır şablonlar için
--     kullanılıyor, bu tablo TAMAMEN AYRI — kullanıcı/bot ÜRETİMİ şablonlar
--     içindir). Bu tablo yukarıdaki DROP bloğuna DAHİL DEĞİL.
-- =====================================================================
create table if not exists public.templates (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references public.community_profiles (id) on delete cascade,
  title             text not null,
  category          text not null check (category in ('software', 'fitness', 'vacation', 'general')),
  cover_url         text,
  goal              text not null, -- usePlanStudio.startFromTemplate'e AYNEN beslenen hedef metni
  total_days        int not null default 7 check (total_days > 0 and total_days <= 365),
  tags              text[] not null default '{}', -- hazır katalog VEYA kullanıcı custom etiketleri (bkz. src/data/communityTags.js)
  -- Rehberli form (GuidedTemplateForm.jsx) 4 cevabı AYRI AYRI da saklanır
  -- (düzenleme ekranında tekrar forma doldurmak için) — gösterimde
  -- story_markdown (formatTemplateStory.js çıktısı) kullanılır.
  story_impact      text,
  story_process     text,
  story_pros_cons   text,
  story_tips        text,
  story_markdown    text not null default '',
  preview_routines  jsonb not null default '[]'::jsonb,
  -- Aktif Plan İçe Aktarma (bkz. GuidedTemplateForm.jsx): kullanıcı sıfırdan
  -- yazmak yerine KENDİ plan(lar)ından birini seçtiğinde, o planın görevleri
  -- düz bir dizi olarak buraya kopyalanır — [{day_number, week_number, title,
  -- detail, duration_min, priority}, ...]. "Planlarıma Ekle" (klon) artık AI
  -- boru hattını yeniden tetiklemez, DOĞRUDAN buradaki gerçek veriden yeni
  -- plan/routines/tasks satırları oluşturur (bkz. communityService.js
  -- cloneTemplateToMyPlans) — TEK TIKLA, anında, tam sadakatle kopyalama.
  -- Kart/detay ekranındaki "⚡ N Rutin | ⏱️ N Saat Odak" rozeti de bu diziden
  -- (+ preview_routines'ten) anlık hesaplanır, ayrı bir sayaç sütunu YOK.
  template_tasks    jsonb not null default '[]'::jsonb,
  is_seed           boolean not null default false, -- bot/tohum içerik mi (bkz. SEED bloğu)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Migration DAHA ÖNCE (template_tasks sütunu OLMADAN) çalıştırılmış olabilir —
-- "create table if not exists" o durumda hiçbir şey yapmaz, bu yüzden eksik
-- sütun ayrıca/güvenle (zaten varsa no-op) eklenir.
alter table public.templates add column if not exists template_tasks jsonb not null default '[]'::jsonb;

create index if not exists templates_author_id_idx on public.templates (author_id);
create index if not exists templates_category_idx on public.templates (category);
create index if not exists templates_created_at_idx on public.templates (created_at desc);
create index if not exists templates_tags_gin_idx on public.templates using gin (tags);

alter table public.templates enable row level security;

drop policy if exists "templates_select_all" on public.templates;
create policy "templates_select_all" on public.templates
  for select using (true);
drop policy if exists "templates_insert_own" on public.templates;
create policy "templates_insert_own" on public.templates
  for insert with check (author_id = public.current_profile_id());
drop policy if exists "templates_update_own" on public.templates;
create policy "templates_update_own" on public.templates
  for update using (author_id = public.current_profile_id()) with check (author_id = public.current_profile_id());
drop policy if exists "templates_delete_own" on public.templates;
create policy "templates_delete_own" on public.templates
  for delete using (author_id = public.current_profile_id());

-- =====================================================================
-- 12) template_likes — beğeni. Bu tablo yukarıdaki DROP bloğuna DAHİL DEĞİL.
-- =====================================================================
create table if not exists public.template_likes (
  template_id uuid not null references public.templates (id) on delete cascade,
  user_id     uuid not null references public.community_profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (template_id, user_id)
);

create index if not exists template_likes_template_idx on public.template_likes (template_id);
create index if not exists template_likes_user_idx on public.template_likes (user_id);

alter table public.template_likes enable row level security;

drop policy if exists "template_likes_select_all" on public.template_likes;
create policy "template_likes_select_all" on public.template_likes
  for select using (true);
drop policy if exists "template_likes_insert_own" on public.template_likes;
create policy "template_likes_insert_own" on public.template_likes
  for insert with check (user_id = public.current_profile_id());
drop policy if exists "template_likes_delete_own" on public.template_likes;
create policy "template_likes_delete_own" on public.template_likes
  for delete using (user_id = public.current_profile_id());

-- =====================================================================
-- 13) template_clones — "Planlarıma Ekle" (klonlama) olay kaydı. Sosyal
--     kanıt (🏆 X Hayata Dokundu rozeti) ve yazar analitiği bunun üzerinden
--     hesaplanır. Bu tablo yukarıdaki DROP bloğuna DAHİL DEĞİL.
-- =====================================================================
create table if not exists public.template_clones (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references public.templates (id) on delete cascade,
  user_id        uuid not null references public.community_profiles (id) on delete cascade,
  cloned_plan_id uuid references public.plans (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists template_clones_template_idx on public.template_clones (template_id);
create index if not exists template_clones_user_idx on public.template_clones (user_id);

alter table public.template_clones enable row level security;

drop policy if exists "template_clones_select_all" on public.template_clones;
create policy "template_clones_select_all" on public.template_clones
  for select using (true);
drop policy if exists "template_clones_insert_own" on public.template_clones;
create policy "template_clones_insert_own" on public.template_clones
  for insert with check (user_id = public.current_profile_id());
-- Bilerek YOK: update/delete policy'si — bir klonlama olayı geçmişe dönük
-- silinmez (istatistik bütünlüğü için, tıpkı focus_sessions gibi).

-- =====================================================================
-- 14) template_comments — yorumlar. `usage_days_at_comment`, yorumun
--     yazıldığı ANDAKİ "kaç gün uyguladı" rozetinin donmuş halidir (bkz.
--     "[🔥 18 Gün Uyguladı]") — sonradan hesaplanan CANLI değer değil,
--     yorumun kendi bağlamı sabit kalsın diye yazma anında donuyor. Bu
--     tablo yukarıdaki DROP bloğuna DAHİL DEĞİL.
-- =====================================================================
create table if not exists public.template_comments (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references public.templates (id) on delete cascade,
  user_id               uuid not null references public.community_profiles (id) on delete cascade,
  content               text not null check (char_length(content) between 1 and 1000),
  usage_days_at_comment int not null default 0,
  created_at            timestamptz not null default now()
);

create index if not exists template_comments_template_idx on public.template_comments (template_id, created_at desc);
create index if not exists template_comments_user_idx on public.template_comments (user_id);

alter table public.template_comments enable row level security;

drop policy if exists "template_comments_select_all" on public.template_comments;
create policy "template_comments_select_all" on public.template_comments
  for select using (true);
drop policy if exists "template_comments_insert_own" on public.template_comments;
create policy "template_comments_insert_own" on public.template_comments
  for insert with check (user_id = public.current_profile_id());
drop policy if exists "template_comments_delete_own" on public.template_comments;
create policy "template_comments_delete_own" on public.template_comments
  for delete using (user_id = public.current_profile_id());

-- =====================================================================
-- 15) template_comment_replies — şablon YAZARININ yorumlara yanıtı
--     ([YAZAR] rozetiyle gösterilir). Yalnızca o şablonun author_id'si
--     kendisi olan kullanıcı yanıt ekleyebilir — bu kural burada, insert
--     policy'sinin WITH CHECK'inde, template_comments → templates join'iyle
--     DOĞRUDAN veritabanı seviyesinde uygulanır (yalnızca UI kısıtlaması
--     DEĞİL). Bu tablo yukarıdaki DROP bloğuna DAHİL DEĞİL.
-- =====================================================================
create table if not exists public.template_comment_replies (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.template_comments (id) on delete cascade,
  author_id  uuid not null references public.community_profiles (id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists template_comment_replies_comment_idx on public.template_comment_replies (comment_id);

alter table public.template_comment_replies enable row level security;

drop policy if exists "template_comment_replies_select_all" on public.template_comment_replies;
create policy "template_comment_replies_select_all" on public.template_comment_replies
  for select using (true);
drop policy if exists "template_comment_replies_insert_author_only" on public.template_comment_replies;
create policy "template_comment_replies_insert_author_only" on public.template_comment_replies
  for insert with check (
    author_id = public.current_profile_id()
    and exists (
      select 1 from public.template_comments c
      join public.templates t on t.id = c.template_id
      where c.id = comment_id and t.author_id = public.current_profile_id()
    )
  );
drop policy if exists "template_comment_replies_delete_own" on public.template_comment_replies;
create policy "template_comment_replies_delete_own" on public.template_comment_replies
  for delete using (author_id = public.current_profile_id());

-- =====================================================================
-- 16) Otomatik istatistikler — VIEW tabanlı (trigger/denormalize edilmiş
--     sayaç YOK, bu yüzden hiçbir zaman "senkron dışı" kalamaz). Şablon
--     kartı/detayı ve Yazar Stüdyosu/Kamusal Profil bunları okur.
-- =====================================================================
create or replace view public.template_stats as
select
  t.id as template_id,
  t.author_id,
  coalesce(l.like_count, 0) as like_count,
  coalesce(c.clone_count, 0) as clone_count,
  coalesce(cm.comment_count, 0) as comment_count
from public.templates t
left join (select template_id, count(*) as like_count from public.template_likes group by template_id) l on l.template_id = t.id
left join (select template_id, count(*) as clone_count from public.template_clones group by template_id) c on c.template_id = t.id
left join (select template_id, count(*) as comment_count from public.template_comments group by template_id) cm on cm.template_id = t.id;

create or replace view public.profile_stats as
select
  p.id as profile_id,
  coalesce(sum(ts.like_count), 0) as total_likes,
  coalesce(sum(ts.clone_count), 0) as total_clones,
  coalesce(sum(ts.comment_count), 0) as total_comments,
  (select count(*) from public.templates where author_id = p.id) as template_count,
  (select count(*) from public.user_follows where following_id = p.id) as follower_count,
  (select count(*) from public.user_follows where follower_id = p.id) as following_count
from public.community_profiles p
left join public.template_stats ts on ts.author_id = p.id
group by p.id;

grant select on public.template_stats to anon, authenticated;
grant select on public.profile_stats to anon, authenticated;

-- =====================================================================
-- 17) SEED — Soğuk başlangıç (Cold-Start) bot içerikleri. Bu blok
--     GÜVENLİ şekilde TEKRAR ÇALIŞTIRILABİLİR (ON CONFLICT DO NOTHING) —
--     migration'ı ikinci kez çalıştırman mevcut botları çoğaltmaz.
--     10 bot profili + her birine 1-2 zengin şablon; gerçekçi beğeni/yorum
--     SAYILARI için template_likes'a GERÇEK (bot-bot) satırlar eklenmez
--     (RLS "kendi profilin" kuralına takılmaz çünkü bu SQL Editor'den
--     service_role/postgres ile çalışır, RLS bypass olur) — beğeni/klon
--     sayıları bu yüzden GERÇEK satır sayılarıyla (template_stats view'i
--     üzerinden) doğal olarak tutarlıdır, sahte bir sayaç YOKTUR.
-- =====================================================================
insert into public.community_profiles (id, username, display_name, avatar_url, bio, usage_days_count, is_bot) values
  ('00000000-0000-0000-0000-000000000001', 'aylin_yazilim', 'Aylin Demir', 'https://i.pravatar.cc/150?img=47', 'Kıdemli yazılım mimarı · 8 yıl deneyim · Derin odak ve sistem tasarımı üzerine yazıyorum.', 412, true),
  ('00000000-0000-0000-0000-000000000002', 'kerem_yks', 'Kerem Aksoy', 'https://i.pravatar.cc/150?img=12', 'YKS 2. Türkiye derecesi · Şimdi başkalarının da bu yolda hızlanmasına yardım ediyorum.', 265, true),
  ('00000000-0000-0000-0000-000000000003', 'zeynep_diyetisyen', 'Dyt. Zeynep Kaya', 'https://i.pravatar.cc/150?img=32', 'Klinik diyetisyen · Sürdürülebilir beslenme rutinleri kurarım, sıkı diyetlere inanmam.', 530, true),
  ('00000000-0000-0000-0000-000000000004', 'burak_sporcu', 'Burak Yıldız', 'https://i.pravatar.cc/150?img=51', 'Kuvvet antrenörü · Push/Pull/Legs ve progressive overload üzerine 6 yıldır program yazıyorum.', 380, true),
  ('00000000-0000-0000-0000-000000000005', 'elif_minimalist', 'Elif Şahin', 'https://i.pravatar.cc/150?img=45', 'Dijital minimalizm ve erken kalkma üzerine yazıyorum. Az ama derinlemesine.', 298, true),
  ('00000000-0000-0000-0000-000000000006', 'mert_gezgin', 'Mert Kaan', 'https://i.pravatar.cc/150?img=15', 'Bütçe dostu rotalar tasarlayan bağımsız gezgin · 40 ülke.', 610, true),
  ('00000000-0000-0000-0000-000000000007', 'selin_if', 'Selin Arslan', 'https://i.pravatar.cc/150?img=48', 'Intermittent Fasting ile 3 yıldır yaşıyorum, 16:8''den başlayanlara rehberlik ediyorum.', 340, true),
  ('00000000-0000-0000-0000-000000000008', 'can_backend', 'Can Öztürk', 'https://i.pravatar.cc/150?img=14', 'Backend mühendisi · Docker/Kubernetes atölyeleri hazırlıyorum.', 455, true),
  ('00000000-0000-0000-0000-000000000009', 'defne_ogrenme', 'Defne Yılmaz', 'https://i.pravatar.cc/150?img=44', 'Meta-öğrenme meraklısı · Dil öğrenimini alışkanlığa çeviren rutinler kurarım.', 220, true),
  ('00000000-0000-0000-0000-000000000010', 'ozan_kilo', 'Ozan Er', 'https://i.pravatar.cc/150?img=53', 'Sertifikalı kişisel antrenör · Kilo alma/verme sürecinde disiplinli ama esnek bir yol izlerim.', 501, true)
on conflict (id) do nothing;

insert into public.templates (id, author_id, title, category, cover_url, goal, total_days, tags, story_impact, story_process, story_pros_cons, story_tips, story_markdown, is_seed) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '14 Günlük Derin Odak Mimarisi',
    'software',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=60',
    '14 günde derin odak/deep work disiplinini sıfırdan kurmak',
    14,
    array['Yazılım', 'Erken Kalkma', 'Minimalizm'],
    'Günlük kesintisiz odak sürem 40 dakikadan 2 saate çıktı, kod kalitem gözle görülür arttı.',
    'İlk 3 gün bildirimleri kapatmak bile zor geldi, ama 1. haftadan sonra beynim "odak saatini" tanımaya başladı.',
    '+Gerçek, ölçülebilir sonuç veriyor. -Sabah rutinine bağlı, atlarsan zinciri kaybediyorsun.',
    'Telefonu başka odada bırak, ilk 90 dakikayı ASLA e-postaya ayırma.',
    '## Hayatıma Katkısı\nGünlük kesintisiz odak sürem 40 dakikadan 2 saate çıktı, kod kalitem gözle görülür arttı.\n\n## Süreç Nasıl İlerledi\nİlk 3 gün bildirimleri kapatmak bile zor geldi, ama 1. haftadan sonra beynim "odak saatini" tanımaya başladı.\n\n## Artıları & Eksileri\n+Gerçek, ölçülebilir sonuç veriyor. -Sabah rutinine bağlı, atlarsan zinciri kaybediyorsun.\n\n## Tavsiyeler & Püf Noktaları\nTelefonu başka odada bırak, ilk 90 dakikayı ASLA e-postaya ayırma.',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '21 Günlük Sürdürülebilir Beslenme',
    'fitness',
    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=60',
    '21 günde kısıtlamadan, sürdürülebilir bir beslenme rutini kurmak',
    21,
    array['Diyet', 'Kilo Verme', 'Spor/Fitness'],
    'Yo-yo diyet döngüsünü kırdım, 21 gün sonunda kısıtlama hissi olmadan 3 kilo verdim.',
    'İlk hafta eski alışkanlıklarla mücadele ettim, ikinci haftadan sonra yemek planlamak otomatikleşti.',
    '+Açlık hissi yok, sürdürülebilir. -Sonuçlar sıkı diyetlere göre daha yavaş görünüyor.',
    'Su takibini aksatma, akşam atıştırmalıklarını akşam rutinine bağla.',
    '## Hayatıma Katkısı\nYo-yo diyet döngüsünü kırdım, 21 gün sonunda kısıtlama hissi olmadan 3 kilo verdim.\n\n## Süreç Nasıl İlerledi\nİlk hafta eski alışkanlıklarla mücadele ettim, ikinci haftadan sonra yemek planlamak otomatikleşti.\n\n## Artıları & Eksileri\n+Açlık hissi yok, sürdürülebilir. -Sonuçlar sıkı diyetlere göre daha yavaş görünüyor.\n\n## Tavsiyeler & Püf Noktaları\nSu takibini aksatma, akşam atıştırmalıklarını akşam rutinine bağla.',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '30 Günlük Push/Pull/Legs',
    'fitness',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=60',
    '30 günde Push/Pull/Legs split ile kuvvet ve kas kütlesi artırmak',
    30,
    array['Spor/Fitness', 'Kilo Alma'],
    'Bench pres 1RM''im 15kg arttı, üst vücut simetrim belirgin şekilde düzeldi.',
    'İlk hafta DOMS (kas ağrısı) ağırdı, 2. haftadan itibaren toparlanma hızlandı.',
    '+Net, ölçülebilir güç artışı. -Haftada 6 gün antrenman ciddi zaman gerektiriyor.',
    'Her antrenmanda son seti gerçek "failure"a kadar götür, uyku düzenini bozma.',
    '## Hayatıma Katkısı\nBench pres 1RM''im 15kg arttı, üst vücut simetrim belirgin şekilde düzeldi.\n\n## Süreç Nasıl İlerledi\nİlk hafta DOMS (kas ağrısı) ağırdı, 2. haftadan itibaren toparlanma hızlandı.\n\n## Artıları & Eksileri\n+Net, ölçülebilir güç artışı. -Haftada 6 gün antrenman ciddi zaman gerektiriyor.\n\n## Tavsiyeler & Püf Noktaları\nHer antrenmanda son seti gerçek "failure"a kadar götür, uyku düzenini bozma.',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000002',
    '45 Günlük YKS Sprint Programı',
    'general',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=60',
    '45 günde YKS için yoğun ama dengeli bir tekrar/deneme programı tamamlamak',
    45,
    array['YKS/Sınav Hazırlık', 'Erken Kalkma'],
    'Deneme netlerim 45 günde ortalama %35 arttı, sınav kaygım azaldı çünkü bir sistemim vardı.',
    'İlk 10 gün tempo çok yoğun geldi, sonra günlük hedefleri küçültüp momentum kazandım.',
    '+Net artışı somut ve hızlı. -Sosyal hayata çok az zaman kalıyor.',
    'Her gün en zayıf konudan başla, akşam mutlaka 15 dk dinlenme rutini koy.',
    '## Hayatıma Katkısı\nDeneme netlerim 45 günde ortalama %35 arttı, sınav kaygım azaldı çünkü bir sistemim vardı.\n\n## Süreç Nasıl İlerledi\nİlk 10 gün tempo çok yoğun geldi, sonra günlük hedefleri küçültüp momentum kazandım.\n\n## Artıları & Eksileri\n+Net artışı somut ve hızlı. -Sosyal hayata çok az zaman kalıyor.\n\n## Tavsiyeler & Püf Noktaları\nHer gün en zayıf konudan başla, akşam mutlaka 15 dk dinlenme rutini koy.',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000005',
    '10 Günlük Dijital Minimalizm Detoksu',
    'general',
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=60',
    '10 günde ekran süresini azaltıp erken kalkma alışkanlığı kurmak',
    10,
    array['Minimalizm', 'Erken Kalkma'],
    'Günlük ekran sürem 6 saatten 2.5 saate düştü, sabah 06:00''da kalkmak artık zor gelmiyor.',
    'İlk 3 gün telefonsuz sabahlar çok garip geldi, 5. günden sonra huzurlu bir rutine dönüştü.',
    '+Zihinsel netlik gerçekten artıyor. -Sosyal medyada iş takibi yapanlar için zorlayıcı olabilir.',
    'Telefonu yatak odasından çıkar, sabah ilk saati kesinlikle ekransız geçir.',
    '## Hayatıma Katkısı\nGünlük ekran sürem 6 saatten 2.5 saate düştü, sabah 06:00''da kalkmak artık zor gelmiyor.\n\n## Süreç Nasıl İlerledi\nİlk 3 gün telefonsuz sabahlar çok garip geldi, 5. günden sonra huzurlu bir rutine dönüştü.\n\n## Artıları & Eksileri\n+Zihinsel netlik gerçekten artıyor. -Sosyal medyada iş takibi yapanlar için zorlayıcı olabilir.\n\n## Tavsiyeler & Püf Noktaları\nTelefonu yatak odasından çıkar, sabah ilk saati kesinlikle ekransız geçir.',
    true
  )
on conflict (id) do nothing;

-- Botlardan birkaç gerçekçi yorum — RLS'i bypass eden SQL Editor/service_role
-- bağlamında eklendiği için "kendi yorumun" kısıtlamasına takılmaz. Sabit
-- id'ler VERİLDİ (id gen_random_uuid() default'una bırakılsaydı her
-- migration çalıştırmasında "on conflict" hiçbir satıra denk gelmez,
-- HER SEFERİNDE yeni/çoğaltılmış satır eklenirdi — güvenli yeniden
-- çalıştırılabilirlik id ÜZERİNDEN sağlanır).
insert into public.template_comments (id, template_id, user_id, content, usage_days_at_comment) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000008', 'Bu programı 2 hafta uyguladım, gerçekten fark yarattı. Sabah rutinini atlamamak kritik.', 18),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', 'Kısıtlama hissi olmadan kilo vermek konusunda haklı, sürdürülebilir bir yaklaşım.', 27),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000009', 'DOMS gerçekten sert başlıyor ama tarif edildiği gibi 2. haftada toparlanma hızlanıyor.', 9),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 'Netlerim gerçekten arttı, özellikle zayıf konudan başlama tavsiyesi işe yaradı.', 40)
on conflict (id) do nothing;

-- =====================================================================

-- =====================================================================
-- 18) SEED (devam) — Bot içeriğini 5'ten 16 şablona genişletir (Yazılım/
--     Kariyer, YKS/Sınav, Diyet/Sağlık, Erken Kalkma/Minimalizm, Seyahat,
--     Dil kategorilerinde) — sayfanın doluluğunu/görsel kalitesini gerçek
--     veriyle göstermek için. Her şablonun `template_tasks` alanı DOLU:
--     kart/detaydaki "⚡ N Rutin | ⏱️ N Saat Odak" rozeti buradan anlık
--     hesaplanır. Ayrıca gerçekçi beğeni/klon satırları (template_likes/
--     template_clones) eklenir — sahte bir SAYAÇ değil, template_stats
--     view'inin okuduğu GERÇEK satırlardır. Güvenle tekrar çalıştırılabilir
--     (tüm insert'ler sabit id + "on conflict ... do nothing").
--
--     NOT (dolar-tırnaklama, $tag$...$tag$): metin/JSON alanları klasik tek
--     tırnak yerine Postgres'in dolar-tırnaklama söz dizimiyle yazılır —
--     Türkçe metinlerdeki apostroflar ('23:30'da', 'Docker'dan' gibi) bu
--     sayede TEK TEK kaçırılmak ('') zorunda kalınmadan güvenle geçilir.
-- =====================================================================
insert into public.templates (id, author_id, title, category, cover_url, goal, total_days, tags, story_impact, story_process, story_pros_cons, story_tips, story_markdown, preview_routines, template_tasks, is_seed) values
  (
    '10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000008', $ti$Full-Stack Senior Olma Rutini$ti$, 'software', 'mono-15',
    $go$6 ayda full-stack senior seviyesine sistemli şekilde ilerlemek$go$, 30, array[$tg$Yazılım$tg$,$tg$Backend$tg$,$tg$Frontend$tg$,$tg$Sistem Tasarımı$tg$],
    $im$Kod review'larda artık mimari seviyede yorum yapabiliyorum, terfi görüşmesi aldım.$im$, $pr$İlk hafta hangi konuya odaklanacağımı bile bilmiyordum, bir müfredat çıkarınca ilerleme somutlaştı.$pr$, $pc$+Net bir yol haritası veriyor. -Her gün en az 2 saat ayırmak gerekiyor.$pc$, $ti2$Her hafta bir tasarım kararını yazıya dök, sadece kod yazma, neden yazdığını da açıkla.$ti2$,
    $md$## Hayatıma Katkısı
Kod review'larda artık mimari seviyede yorum yapabiliyorum, terfi görüşmesi aldım.

## Süreç Nasıl İlerledi
İlk hafta hangi konuya odaklanacağımı bile bilmiyordum, bir müfredat çıkarınca ilerleme somutlaştı.

## Artıları & Eksileri
+Net bir yol haritası veriyor. -Her gün en az 2 saat ayırmak gerekiyor.

## Tavsiyeler & Püf Noktaları
Her hafta bir tasarım kararını yazıya dök, sadece kod yazma, neden yazdığını da açıkla.$md$,
    $rt$[{"content": "Her gün 1 teknik makale özetle", "frequency": "daily"}, {"content": "Haftada 1 mimari karar dokümante et", "frequency": "weekly"}]$rt$::jsonb,
    $tk$[{"day_number": 1, "week_number": 1, "title": "Sistem tasarımı temelleri", "detail": "Ölçeklenebilirlik/CAP teoremi okuması", "duration_min": 60, "priority": "Yüksek"}, {"day_number": 2, "week_number": 1, "title": "API tasarımı pratiği", "detail": "REST vs GraphQL karşılaştırmalı mini proje", "duration_min": 90, "priority": "Orta"}, {"day_number": 5, "week_number": 1, "title": "Veritabanı indeksleme", "detail": "Gerçek bir sorguyu EXPLAIN ile analiz et", "duration_min": 45, "priority": "Orta"}, {"day_number": 8, "week_number": 2, "title": "Code review katılımı", "detail": "Bir PR'a mimari seviyede yorum yaz", "duration_min": 30, "priority": "Yüksek"}, {"day_number": 12, "week_number": 2, "title": "Cache stratejileri", "detail": "Redis ile basit bir cache katmanı kur", "duration_min": 75, "priority": "Orta"}, {"day_number": 18, "week_number": 3, "title": "Load balancing", "detail": "Nginx ile basit bir LB deneyi", "duration_min": 60, "priority": "Düşük"}]$tk$::jsonb,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', $ti$Gece Kodu & Derin Fokus Planı$ti$, 'software', 'mono-21',
    $go$21 günde gece saatlerinde kesintisiz derin odak rutini kurmak$go$, 21, array[$tg$Yazılım$tg$,$tg$Minimalizm$tg$],
    $im$Gece 22:00-24:00 arası artık en üretken saatlerim, günlük commit sayım 2 katına çıktı.$im$, $pr$İlk hafta uyku düzenim bozuldu, sonra saat 23:30'da kesin bitiş koyunca denge oturdu.$pr$, $pc$+Kesintisiz, sessiz bir ortam sağlıyor. -Sosyal hayatla çakışabiliyor.$pc$, $ti2$Kesin bir bitiş saati koy, yoksa uyku borcu birikir.$ti2$,
    $md$## Hayatıma Katkısı
Gece 22:00-24:00 arası artık en üretken saatlerim, günlük commit sayım 2 katına çıktı.

## Süreç Nasıl İlerledi
İlk hafta uyku düzenim bozuldu, sonra saat 23:30'da kesin bitiş koyunca denge oturdu.

## Artıları & Eksileri
+Kesintisiz, sessiz bir ortam sağlıyor. -Sosyal hayatla çakışabiliyor.

## Tavsiyeler & Püf Noktaları
Kesin bir bitiş saati koy, yoksa uyku borcu birikir.$md$,
    $rt$[{"content": "Gece 23:30'da kesin bitiş", "frequency": "daily"}, {"content": "Sabah commit geçmişini gözden geçir", "frequency": "daily"}]$rt$::jsonb,
    $tk$[{"day_number": 1, "week_number": 1, "title": "Ortam hazırlığı", "detail": "Bildirimleri kapat, kahve/su hazırla", "duration_min": 15, "priority": "Düşük"}, {"day_number": 2, "week_number": 1, "title": "90 dk derin odak bloğu", "detail": "Tek bir modül üzerinde kesintisiz çalış", "duration_min": 90, "priority": "Yüksek"}, {"day_number": 6, "week_number": 1, "title": "Refactor gecesi", "detail": "Eski bir modülü temizle", "duration_min": 60, "priority": "Orta"}, {"day_number": 10, "week_number": 2, "title": "Yeni özellik geliştirme", "detail": "Uçtan uca bir özellik tamamla", "duration_min": 120, "priority": "Yüksek"}, {"day_number": 15, "week_number": 3, "title": "Test yazımı", "detail": "Kritik modüle unit test ekle", "duration_min": 60, "priority": "Orta"}]$tk$::jsonb,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000002', $ti$Derece Öğrencisinin 12 Saatlik Çalışma Bloğu$ti$, 'general', 'mono-04',
    $go$YKS'de üst düzey sonuç için günlük 12 saatlik yoğun çalışma disiplini kurmak$go$, 60, array[$tg$YKS/Sınav Hazırlık$tg$,$tg$Erken Kalkma$tg$],
    $im$Günlük çalışma sürem 12 saate çıktı ama yorulmadan, çünkü molalar da planın parçası.$im$, $pr$İlk günler 12 saat imkansız görünüyordu, molaları doğru yerleştirince sürdürülebilir oldu.$pr$, $pc$+Maksimum verim. -Çok disiplin ve fiziksel dayanıklılık istiyor.$pc$, $ti2$Her 50 dakikada 10 dakika kesin mola ver, atlamak seni yavaşlatır.$ti2$,
    $md$## Hayatıma Katkısı
Günlük çalışma sürem 12 saate çıktı ama yorulmadan, çünkü molalar da planın parçası.

## Süreç Nasıl İlerledi
İlk günler 12 saat imkansız görünüyordu, molaları doğru yerleştirince sürdürülebilir oldu.

## Artıları & Eksileri
+Maksimum verim. -Çok disiplin ve fiziksel dayanıklılık istiyor.

## Tavsiyeler & Püf Noktaları
Her 50 dakikada 10 dakika kesin mola ver, atlamak seni yavaşlatır.$md$,
    $rt$[{"content": "Her gün 06:00 kalk", "frequency": "daily"}, {"content": "Her akşam yanlış analizi yap", "frequency": "daily"}]$rt$::jsonb,
    $tk$[{"day_number": 1, "week_number": 1, "title": "Sabah bloğu (matematik)", "detail": "3x50dk Pomodoro", "duration_min": 150, "priority": "Yüksek"}, {"day_number": 1, "week_number": 1, "title": "Öğle bloğu (fen)", "detail": "3x50dk Pomodoro", "duration_min": 150, "priority": "Yüksek"}, {"day_number": 1, "week_number": 1, "title": "Akşam bloğu (deneme analizi)", "detail": "Yanlış analizi + tekrar", "duration_min": 120, "priority": "Orta"}, {"day_number": 7, "week_number": 1, "title": "Haftalık deneme", "detail": "Tam süreli TYT denemesi", "duration_min": 180, "priority": "Yüksek"}, {"day_number": 14, "week_number": 2, "title": "Zayıf konu kampı", "detail": "En düşük netli 2 konuya odaklan", "duration_min": 180, "priority": "Yüksek"}]$tk$::jsonb,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000002', $ti$TYT Net Artırma Kampı$ti$, 'general', 'mono-04',
    $go$30 günde TYT netlerini sistemli tekrar ile artırmak$go$, 30, array[$tg$YKS/Sınav Hazırlık$tg$],
    $im$TYT netlerim 30 günde 15 net arttı, özellikle Türkçe ve matematikte.$im$, $pr$İlk hafta hangi konuda net kaybettiğimi bile bilmiyordum, deneme analizi bunu netleştirdi.$pr$, $pc$+Somut net artışı. -Yalnızca TYT'ye odaklanıyor, AYT ihmal edilebilir.$pc$, $ti2$Her deneme sonrası yanlışlarını konu bazlı bir tabloya işle.$ti2$,
    $md$## Hayatıma Katkısı
TYT netlerim 30 günde 15 net arttı, özellikle Türkçe ve matematikte.

## Süreç Nasıl İlerledi
İlk hafta hangi konuda net kaybettiğimi bile bilmiyordum, deneme analizi bunu netleştirdi.

## Artıları & Eksileri
+Somut net artışı. -Yalnızca TYT'ye odaklanıyor, AYT ihmal edilebilir.

## Tavsiyeler & Püf Noktaları
Her deneme sonrası yanlışlarını konu bazlı bir tabloya işle.$md$,
    $rt$[{"content": "Günde 40 soru çöz", "frequency": "daily"}, {"content": "Haftada 1 tam deneme", "frequency": "weekly"}]$rt$::jsonb,
    $tk$[{"day_number": 1, "week_number": 1, "title": "Konu tekrarı: Türkçe paragraf", "detail": "Hızlı okuma teknikleri", "duration_min": 60, "priority": "Orta"}, {"day_number": 3, "week_number": 1, "title": "Matematik temel kavramlar", "detail": "Sayılar ünitesi tekrar", "duration_min": 90, "priority": "Yüksek"}, {"day_number": 7, "week_number": 1, "title": "Haftalık TYT denemesi", "detail": "Tam süreli deneme + analiz", "duration_min": 165, "priority": "Yüksek"}, {"day_number": 14, "week_number": 2, "title": "Fen bilimleri hız çalışması", "detail": "Zamanlı soru çözümü", "duration_min": 75, "priority": "Orta"}, {"day_number": 21, "week_number": 3, "title": "Genel tekrar", "detail": "Tüm derslerden karışık test", "duration_min": 120, "priority": "Yüksek"}]$tk$::jsonb,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000007', $ti$Intermittent Fasting & 10k Adım$ti$, 'fitness', 'mono-25',
    $go$21 günde 16:8 aralıklı oruç ile günlük 10.000 adım rutini kurmak$go$, 21, array[$tg$Intermittent Fasting$tg$,$tg$Diyet$tg$,$tg$Kilo Verme$tg$],
    $im$Enerjim gün boyu daha dengeli, sindirim sorunlarım büyük ölçüde azaldı.$im$, $pr$İlk 4 gün açlık hissi zorladı, sonra vücut 16 saatlik pencereye alıştı.$pr$, $pc$+Basit, kısıtlama listesi yok. -İlk günler açlık toleransı gerektiriyor.$pc$, $ti2$Oruç penceresinde bol su iç, ilk öğünü proteinle aç.$ti2$,
    $md$## Hayatıma Katkısı
Enerjim gün boyu daha dengeli, sindirim sorunlarım büyük ölçüde azaldı.

## Süreç Nasıl İlerledi
İlk 4 gün açlık hissi zorladı, sonra vücut 16 saatlik pencereye alıştı.

## Artıları & Eksileri
+Basit, kısıtlama listesi yok. -İlk günler açlık toleransı gerektiriyor.

## Tavsiyeler & Püf Noktaları
Oruç penceresinde bol su iç, ilk öğünü proteinle aç.$md$,
    $rt$[{"content": "Günlük 10.000 adım", "frequency": "daily"}, {"content": "Yeme penceresini 8 saatte tut", "frequency": "daily"}]$rt$::jsonb,
    $tk$[{"day_number": 1, "week_number": 1, "title": "İlk oruç günü", "detail": "12:00-20:00 yeme penceresi", "duration_min": 0, "priority": "Orta"}, {"day_number": 1, "week_number": 1, "title": "Yürüyüş", "detail": "10.000 adım tamamla", "duration_min": 60, "priority": "Orta"}, {"day_number": 5, "week_number": 1, "title": "Pencere daraltma", "detail": "16:8'e geçiş", "duration_min": 0, "priority": "Orta"}, {"day_number": 10, "week_number": 2, "title": "Direnç antrenmanı", "detail": "Haftada 2 gün ağırlık", "duration_min": 45, "priority": "Orta"}, {"day_number": 18, "week_number": 3, "title": "Değerlendirme", "detail": "Kilo/çevre ölçümü kaydet", "duration_min": 15, "priority": "Düşük"}]$tk$::jsonb,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000010', $ti$Sıkı Yağ Yakım & Definasyon$ti$, 'fitness', 'mono-11',
    $go$8 haftada kalori açığı ve yüksek hacimli antrenmanla definasyon sağlamak$go$, 56, array[$tg$Kilo Verme$tg$,$tg$Spor/Fitness$tg$,$tg$Sıkı Diyet$tg$],
    $im$Vücut yağ oranım %8 azaldı, kas kütlemi büyük ölçüde koruyarak.$im$, $pr$İlk 2 hafta enerjim düşüktü, kalori açığını kademeli artırınca performans geri geldi.$pr$, $pc$+Hızlı görsel sonuç. -Sıkı takip ve disiplin gerektiriyor, sürdürülebilirliği düşük.$pc$, $ti2$Proteini asla düşürme, kaybı kalori değil yağdan yap.$ti2$,
    $md$## Hayatıma Katkısı
Vücut yağ oranım %8 azaldı, kas kütlemi büyük ölçüde koruyarak.

## Süreç Nasıl İlerledi
İlk 2 hafta enerjim düşüktü, kalori açığını kademeli artırınca performans geri geldi.

## Artıları & Eksileri
+Hızlı görsel sonuç. -Sıkı takip ve disiplin gerektiriyor, sürdürülebilirliği düşük.

## Tavsiyeler & Püf Noktaları
Proteini asla düşürme, kaybı kalori değil yağdan yap.$md$,
    $rt$[{"content": "Günlük protein hedefini tuttur", "frequency": "daily"}, {"content": "Haftada 1 ölçüm/fotoğraf", "frequency": "weekly"}]$rt$::jsonb,
    $tk$[{"day_number": 1, "week_number": 1, "title": "Kalori/makro hesaplama", "detail": "Açık kalori + yüksek protein plan", "duration_min": 30, "priority": "Yüksek"}, {"day_number": 2, "week_number": 1, "title": "Ağırlık antrenmanı A", "detail": "Üst vücut hacim seti", "duration_min": 75, "priority": "Yüksek"}, {"day_number": 4, "week_number": 1, "title": "Kardiyo (LISS)", "detail": "45 dk düşük tempo kardiyo", "duration_min": 45, "priority": "Orta"}, {"day_number": 14, "week_number": 2, "title": "Ölçüm & fotoğraf", "detail": "İlerleme takibi", "duration_min": 15, "priority": "Düşük"}, {"day_number": 28, "week_number": 4, "title": "Orta değerlendirme", "detail": "Plan revizyonu", "duration_min": 30, "priority": "Orta"}]$tk$::jsonb,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000005', $ti$Sabah 05:00 Kulübü & Minimalist Yaşam$ti$, 'general', 'mono-02',
    $go$14 günde sabah 05:00'te kalkma disiplinini minimalist bir günlük rutinle kurmak$go$, 14, array[$tg$Erken Kalkma$tg$,$tg$Minimalizm$tg$,$tg$Dijital Detoks$tg$],
    $im$Güne sakin başlıyorum, gün içi kararlarım daha net çünkü zihnim dolu değil.$im$, $pr$İlk 3 gün çok zordu, akşam rutinini sadeleştirince sabah kalkmak kolaylaştı.$pr$, $pc$+Zihinsel netlik yüksek. -Sosyal etkinlikler akşam saatlerini kısıtlıyor.$pc$, $ti2$Akşam 21:30'da ekranları kapat, sabah alarmı odadan uzağa koy.$ti2$,
    $md$## Hayatıma Katkısı
Güne sakin başlıyorum, gün içi kararlarım daha net çünkü zihnim dolu değil.

## Süreç Nasıl İlerledi
İlk 3 gün çok zordu, akşam rutinini sadeleştirince sabah kalkmak kolaylaştı.

## Artıları & Eksileri
+Zihinsel netlik yüksek. -Sosyal etkinlikler akşam saatlerini kısıtlıyor.

## Tavsiyeler & Püf Noktaları
Akşam 21:30'da ekranları kapat, sabah alarmı odadan uzağa koy.$md$,
    $rt$[{"content": "05:00 kalkış", "frequency": "daily"}, {"content": "21:30 ekran kapatma", "frequency": "daily"}]$rt$::jsonb,
    $tk$[{"day_number": 1, "week_number": 1, "title": "Akşam sadeleştirme", "detail": "21:30 ekran kapatma rutini", "duration_min": 10, "priority": "Orta"}, {"day_number": 1, "week_number": 1, "title": "Sabah 05:00 kalkış", "detail": "Alarm + 10dk esneme", "duration_min": 10, "priority": "Yüksek"}, {"day_number": 3, "week_number": 1, "title": "Sabah sayfası", "detail": "3 sayfa serbest yazım", "duration_min": 20, "priority": "Düşük"}, {"day_number": 7, "week_number": 1, "title": "Haftalık gözden geçirme", "detail": "Neyin işe yaradığını değerlendir", "duration_min": 20, "priority": "Orta"}, {"day_number": 10, "week_number": 2, "title": "Dijital detoks bloğu", "detail": "2 saat ekransız zaman", "duration_min": 120, "priority": "Orta"}]$tk$::jsonb,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000008', $ti$Docker & Kubernetes Atölye Serisi$ti$, 'software', 'mono-07',
    $go$14 günde Docker'dan Kubernetes'e üretim seviyesinde konteynerleşme öğrenmek$go$, 14, array[$tg$DevOps$tg$,$tg$Backend$tg$,$tg$Yazılım$tg$],
    $im$Artık bir servisi güvenle konteynerleştirip production'a alabiliyorum.$im$, $pr$Kubernetes kavramları ilk başta soyut geldi, gerçek bir mini proje ile somutlaştı.$pr$, $pc$+Uygulamalı, elle tutulur. -Kubernetes kısmı dik bir öğrenme eğrisi istiyor.$pc$, $ti2$Her kavramı önce Docker'da dene, sonra Kubernetes'e taşı.$ti2$,
    $md$## Hayatıma Katkısı
Artık bir servisi güvenle konteynerleştirip production'a alabiliyorum.

## Süreç Nasıl İlerledi
Kubernetes kavramları ilk başta soyut geldi, gerçek bir mini proje ile somutlaştı.

## Artıları & Eksileri
+Uygulamalı, elle tutulur. -Kubernetes kısmı dik bir öğrenme eğrisi istiyor.

## Tavsiyeler & Püf Noktaları
Her kavramı önce Docker'da dene, sonra Kubernetes'e taşı.$md$,
    $rt$[{"content": "Her gün resmi dokümantasyon oku", "frequency": "daily"}, {"content": "Her imajı optimize edip boyut kıyasla", "frequency": "daily"}]$rt$::jsonb,
    $tk$[{"day_number": 1, "week_number": 1, "title": "Dockerfile temelleri", "detail": "Basit bir servisi konteynerleştir", "duration_min": 60, "priority": "Yüksek"}, {"day_number": 3, "week_number": 1, "title": "Multi-stage build", "detail": "İmaj boyutunu optimize et", "duration_min": 45, "priority": "Orta"}, {"day_number": 6, "week_number": 1, "title": "Docker Compose", "detail": "Çoklu servis orkestrasyon", "duration_min": 75, "priority": "Orta"}, {"day_number": 9, "week_number": 2, "title": "K8s temel kavramlar", "detail": "Pod/Deployment/Service", "duration_min": 60, "priority": "Yüksek"}, {"day_number": 13, "week_number": 2, "title": "Mini production deploy", "detail": "Basit bir cluster'a deploy", "duration_min": 90, "priority": "Yüksek"}]$tk$::jsonb,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000006', $ti$Bütçe Dostu 7 Günlük Kapadokya-Ege Rotası$ti$, 'vacation', 'mono-29',
    $go$7 günde bütçe dostu bir Kapadokya-Ege seyahat rotasını planlamak$go$, 7, array[$tg$Bütçe Seyahat$tg$,$tg$Rota Planlama$tg$],
    $im$Bütçemin %30 altında, unutulmaz bir rota çıkardım — planlama gerçekten paradan tasarruf ettiriyor.$im$, $pr$İlk planım çok yoğundu, günde 1 ana durağa indirince hem bütçe hem keyif dengelendi.$pr$, $pc$+Bütçe dostu, esnek. -Yoğun sezon dışı planlanmalı.$pc$, $ti2$Konaklamayı erken rezerve et, yerel ulaşımı tercih et.$ti2$,
    $md$## Hayatıma Katkısı
Bütçemin %30 altında, unutulmaz bir rota çıkardım — planlama gerçekten paradan tasarruf ettiriyor.

## Süreç Nasıl İlerledi
İlk planım çok yoğundu, günde 1 ana durağa indirince hem bütçe hem keyif dengelendi.

## Artıları & Eksileri
+Bütçe dostu, esnek. -Yoğun sezon dışı planlanmalı.

## Tavsiyeler & Püf Noktaları
Konaklamayı erken rezerve et, yerel ulaşımı tercih et.$md$,
    $rt$[{"content": "Günlük bütçe takibi", "frequency": "daily"}, {"content": "Her durakta 1 yerel lezzet dene", "frequency": "daily"}]$rt$::jsonb,
    $tk$[{"day_number": 1, "week_number": 1, "title": "Kapadokya varış", "detail": "Yerleşim + çevre keşif", "duration_min": 120, "priority": "Düşük"}, {"day_number": 2, "week_number": 1, "title": "Balon turu (opsiyonel)", "detail": "Gün doğumu turu", "duration_min": 180, "priority": "Orta"}, {"day_number": 3, "week_number": 1, "title": "Vadi yürüyüşü", "detail": "Kızıl Vadi rotası", "duration_min": 150, "priority": "Orta"}, {"day_number": 5, "week_number": 1, "title": "Ege'ye geçiş", "detail": "Otobüs/uçak transferi", "duration_min": 240, "priority": "Düşük"}, {"day_number": 6, "week_number": 1, "title": "Sahil günü", "detail": "Koy keşfi + yerel lezzetler", "duration_min": 180, "priority": "Düşük"}]$tk$::jsonb,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000009', $ti$30 Günde Akıcı İngilizce Konuşma Sprinti$ti$, 'general', 'mono-30',
    $go$30 günde günlük konuşma pratiğiyle İngilizce akıcılığını artırmak$go$, 30, array[$tg$Dil Sınavı$tg$,$tg$Minimalizm$tg$],
    $im$Artık günlük sohbetlerde durup çeviri yapmıyorum, doğrudan İngilizce düşünebiliyorum.$im$, $pr$İlk hafta konuşurken çok tutuklanıyordum, gölge okuma (shadowing) pratiği akıcılığı hızlandırdı.$pr$, $pc$+Somut, günlük ilerleme hissi veriyor. -Konuşacak partner bulmak zor olabilir.$pc$, $ti2$Her gün en az 10 dakika sesli konuş, yazmak yetmez.$ti2$,
    $md$## Hayatıma Katkısı
Artık günlük sohbetlerde durup çeviri yapmıyorum, doğrudan İngilizce düşünebiliyorum.

## Süreç Nasıl İlerledi
İlk hafta konuşurken çok tutuklanıyordum, gölge okuma (shadowing) pratiği akıcılığı hızlandırdı.

## Artıları & Eksileri
+Somut, günlük ilerleme hissi veriyor. -Konuşacak partner bulmak zor olabilir.

## Tavsiyeler & Püf Noktaları
Her gün en az 10 dakika sesli konuş, yazmak yetmez.$md$,
    $rt$[{"content": "Günlük 15dk gölge okuma", "frequency": "daily"}, {"content": "Haftalık video günlüğü", "frequency": "weekly"}]$rt$::jsonb,
    $tk$[{"day_number": 1, "week_number": 1, "title": "Gölge okuma", "detail": "10dk podcast shadowing", "duration_min": 15, "priority": "Orta"}, {"day_number": 3, "week_number": 1, "title": "Kelime pratiği", "detail": "5 yeni kelimeyi cümlede kullan", "duration_min": 15, "priority": "Düşük"}, {"day_number": 7, "week_number": 1, "title": "Serbest konuşma", "detail": "Kendine 5dk konuşma kaydı", "duration_min": 10, "priority": "Orta"}, {"day_number": 14, "week_number": 2, "title": "Karşılıklı pratik", "detail": "Dil değişim partneriyle 20dk", "duration_min": 20, "priority": "Yüksek"}, {"day_number": 21, "week_number": 3, "title": "Video günlüğü", "detail": "Haftalık ilerleme videosu", "duration_min": 15, "priority": "Düşük"}]$tk$::jsonb,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000003', $ti$Aile İçin Sürdürülebilir Menü Planlama$ti$, 'fitness', 'mono-08',
    $go$14 günde aile için dengeli ve sürdürülebilir bir menü planlama rutini kurmak$go$, 14, array[$tg$Diyet$tg$,$tg$Sıkı Diyet$tg$],
    $im$Haftalık market masrafım azaldı, yemek israfı neredeyse sıfırlandı.$im$, $pr$İlk hafta planlamak zaman kaybı gibi hissettirdi, ikinci haftadan itibaren zaman kazandırmaya başladı.$pr$, $pc$+Zaman ve bütçe tasarrufu sağlıyor. -Haftalık 30dk planlama zamanı gerektiriyor.$pc$, $ti2$Haftalık menüyü pazar günü tek seferde çıkar, listeye sadık kal.$ti2$,
    $md$## Hayatıma Katkısı
Haftalık market masrafım azaldı, yemek israfı neredeyse sıfırlandı.

## Süreç Nasıl İlerledi
İlk hafta planlamak zaman kaybı gibi hissettirdi, ikinci haftadan itibaren zaman kazandırmaya başladı.

## Artıları & Eksileri
+Zaman ve bütçe tasarrufu sağlıyor. -Haftalık 30dk planlama zamanı gerektiriyor.

## Tavsiyeler & Püf Noktaları
Haftalık menüyü pazar günü tek seferde çıkar, listeye sadık kal.$md$,
    $rt$[{"content": "Pazar günü haftalık menü planla", "frequency": "weekly"}, {"content": "Market israfını not al", "frequency": "weekly"}]$rt$::jsonb,
    $tk$[{"day_number": 1, "week_number": 1, "title": "Haftalık menü taslağı", "detail": "7 günlük dengeli menü çıkar", "duration_min": 30, "priority": "Orta"}, {"day_number": 1, "week_number": 1, "title": "Market listesi", "detail": "Menüye göre liste hazırla", "duration_min": 15, "priority": "Düşük"}, {"day_number": 7, "week_number": 1, "title": "Menü gözden geçirme", "detail": "Neyin işe yaradığını not al", "duration_min": 15, "priority": "Düşük"}]$tk$::jsonb,
    true
  )
on conflict (id) do nothing;

insert into public.template_likes (template_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000008'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000009'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000010'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000008'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000009'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000010'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000008'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000009'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000010'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000009'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000010'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000010'),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000008'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000009'),
  ('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000008'),
  ('10000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000009'),
  ('10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000008'),
  ('10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000010'),
  ('10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000008'),
  ('10000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000009'),
  ('10000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000010'),
  ('10000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000004')
on conflict (template_id, user_id) do nothing;

insert into public.template_clones (id, template_id, user_id) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000007'),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000009'),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000009'),
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000004'),
  ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000007'),
  ('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000007')
on conflict (id) do nothing;


-- =====================================================================
-- 19) SEED (devam 2) — 3 ek bot profili (toplam 13'e çıkarır), 5 orijinal
--     şablonun kırık Unsplash URL'lerini presetCovers.js kataloğundaki
--     mono-XX kapaklarla değiştirir (aksi halde coverById() eşleşme
--     bulamayıp hepsi için AYNI varsayılan kapağı gösteriyordu — görsel
--     çeşitlilik kaybı), ve 5-16 numaralı şablonlara (o ana kadar HİÇ
--     yorumu olmayan 12 şablon) gerçekçi yorumlar + birkaçına şablon
--     YAZARININ yanıtı ekler. Güvenle tekrar çalıştırılabilir (sabit id +
--     "on conflict ... do nothing"; UPDATE'ler idempotent).
-- =====================================================================

insert into public.community_profiles (id, username, display_name, avatar_url, bio, usage_days_count, is_bot) values
  ('00000000-0000-0000-0000-000000000011', 'efe_fullstack', 'Efe Korkmaz', 'https://i.pravatar.cc/150?img=33', 'Full-stack mühendis · Junior''dan Senior''a giden yolu rehberli, ölçülebilir adımlarla anlatıyorum.', 190, true),
  ('00000000-0000-0000-0000-000000000012', 'selin_derece', 'Selin Yurt', 'https://i.pravatar.cc/150?img=29', 'Üniversite sınavında Türkiye derecesi · Uzun/yoğun çalışma bloklarını sürdürülebilir kılan sistemler kurarım.', 275, true),
  ('00000000-0000-0000-0000-000000000013', 'arda_minimalist', 'Arda Çelik', 'https://i.pravatar.cc/150?img=52', 'Minimalist yaşam ve dijital detoks üzerine yazıyorum · Az eşya, az bildirim, çok derin iş.', 150, true)
on conflict (id) do nothing;

update public.templates set cover_url = 'mono-03' where id = '10000000-0000-0000-0000-000000000001';
update public.templates set cover_url = 'mono-06' where id = '10000000-0000-0000-0000-000000000002';
update public.templates set cover_url = 'mono-16' where id = '10000000-0000-0000-0000-000000000003';
update public.templates set cover_url = 'mono-18' where id = '10000000-0000-0000-0000-000000000004';
update public.templates set cover_url = 'mono-14' where id = '10000000-0000-0000-0000-000000000005';

insert into public.template_comments (id, template_id, user_id, content, usage_days_at_comment) values
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', 'Ekranı yatak odasından çıkarmak gerçekten işe yarıyor, ilk hafta zor ama sonra fark yaratıyor.', 60),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000013', 'Minimalizmi günlük rutine bu kadar somut bağlayan az örnek gördüm.', 95),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Mimari seviyede yorum yapabilmek gerçekten terfi için kritik, ben de aynı yolu izledim.', 200),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000011', 'Bu rotayı 3 haftadır uyguluyorum, code review''larda özgüvenim arttı.', 21),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000008', 'Gece 23:30''da kesin bitiş kuralı olmadan uyku düzenim hep bozuluyordu, bu tavsiye gerçekten işe yaradı.', 33),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000012', '12 saat kulağa çok geliyor ama molaları doğru yerleştirince gerçekten sürdürülebilir.', 40),
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000009', 'Yanlış analizini akşam bloğuna sabitlemek harika bir fikir.', 15),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000004', 'TYT netlerim de bu sistemle arttı, konu bazlı tablo tutmak gerçekten fark yaratıyor.', 12),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000010', '16:8 ile başlamak için güzel bir rehber, ilk öğünü proteinle açmak tavsiyesi çok değerli.', 88),
  ('20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000004', 'Proteini düşürmeme kuralı olmadan kas kaybı kaçınılmaz oluyor, çok doğru bir vurgu.', 150),
  ('20000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000006', 'Seyahat ederken bile bu rutini korumaya çalışıyorum, zihinsel netlik gerçekten farklı.', 300),
  ('20000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Multi-stage build kısmı imaj boyutunu inanılmaz düşürdü, teşekkürler.', 250),
  ('20000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000003', 'Bütçe dostu ama hiç kısıtlanmış hissettirmeyen bir rota, aileme de önerdim.', 400),
  ('20000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000005', 'Gölge okuma pratiği gerçekten akıcılığı hızlandırıyor, 2 haftadır uyguluyorum.', 45),
  ('20000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000007', 'Market israfını not almak, aslında ne kadar tasarruf ettiğimi görünce motivasyonumu artırdı.', 60)
on conflict (id) do nothing;

-- Şablon YAZARININ yorumlara yanıtı ([YAZAR] rozeti) — author_id her satırda
-- o şablonun gerçek author_id'siyle eşleşir (RLS'in de zorunlu kıldığı kural).
insert into public.template_comment_replies (id, comment_id, author_id, content) values
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000008', 'Teşekkürler! Code review''da mimari seviyede yorum yapmak zaman alıyor ama gerçekten değerli.'),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Kesin bitiş saati koymadan bu rutin çok kolay dağılıyor, haklısın!'),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'Molaları atlamak insanı yavaşlatıyor, bunu ilk hafta ben de fark ettim.'),
  ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000007', '16:8''e geçişi kademeli yapmak gerçekten sürdürülebilirliği artırıyor, aynen öyle!'),
  ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000005', 'Seyahatte bile korumak büyük başarı, tebrikler!'),
  ('21000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000006', 'Aileye önermen beni çok mutlu etti, iyi geziler!')
on conflict (id) do nothing;
