-- =====================================================================
-- Ücretsiz hesap başına maksimum 10 aktif plan — SUNUCU TARAFI, RLS'in
-- kendisi kadar güvenilir bir katman (BEFORE INSERT trigger). Supabase
-- SQL Editor'e yapıştırıp "Run" ile çalıştır. Güvenle tekrar çalıştırılabilir.
--
-- NEDEN TRIGGER (yalnızca client-side kontrol DEĞİL): plan oluşturma
-- YALNIZCA usePlanStudio.startNewPlan üzerinden değil, Nexus şablon
-- klonlama (communityService.cloneTemplateToMyPlans — SharedTemplateView.jsx
-- VE TemplateDetailModal.jsx'ten doğrudan çağrılıyor) üzerinden de olabiliyor.
-- İki AYRI client kod yolunu senkron tutmak yerine, TEK gerçek kaynak
-- veritabanı seviyesinde: hangi yoldan gelirse gelsin 11. plan denemesi
-- reddedilir. Client tarafı (usePlanStudio.js) YİNE DE kendi kontrolünü
-- yapıyor — sebebi UX: kullanıcı hatayı bir DB hata mesajı olarak değil,
-- şık bir modal olarak görsün diye baştan engellenir; trigger yalnızca
-- son çare/bypass koruması.
-- =====================================================================

create or replace function public.enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count from public.plans where user_id = new.user_id;
  if v_count >= 10 then
    raise exception 'PLAN_LIMIT_REACHED: Maksimum 10 aktif plan limitine ulaşıldı.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists plans_enforce_limit on public.plans;
create trigger plans_enforce_limit
  before insert on public.plans
  for each row execute function public.enforce_plan_limit();
