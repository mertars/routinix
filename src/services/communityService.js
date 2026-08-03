import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

// "Topluluk Şablon Hub'ı" — şablon CRUD/arama/beğeni/klonlama. Tüm sorgular
// authenticated/anon Supabase client'ı ile DOĞRUDAN yapılır (server-role
// gerektiren bir işlem yok — templates/likes/comments RLS "herkes okur,
// yalnızca kendi satırını yazar" politikasıyla zaten güvenli, bkz.
// supabase/migration.sql 9-16. bölümler).
//
// "Planlarıma Ekle" (klon) NASIL ÇALIŞIR: Bu modül YENİ bir plan/task
// oluşturma mekanizması İCAT ETMEZ — mevcut TemplateHub.jsx'in "Şablonu
// Kullan" akışıyla (usePlanStudio.startFromTemplate → dinamik onboarding
// wizard → AI plan üretimi) AYNI, zaten var olan/test edilmiş boru hattını
// kullanır (bkz. CommunityHub.jsx'in onClone prop'u, app.jsx'te
// ps.startFromTemplate'e bağlanır). Bu servis yalnızca "kim ne zaman
// klonladı" sosyal-kanıt olayını kaydeder (template_clones).

// Templates + yazar profili + canlı istatistikler (beğeni/klon/yorum sayısı,
// bkz. template_stats view'i) — arama metni, etiket(ler), kategori ve
// "yalnızca takip edilenler" (authorIds) filtreleriyle.
export async function fetchTemplates({ search = "", tags = [], category = null, authorIds = null, limit = 60 } = {}) {
  let query = supabase
    .from("templates")
    // "!author_id" DEĞİŞTİRİLEMEZ bir ip ucu: PostgREST'in şema önbelleğinde
    // templates ↔ community_profiles arasında BİRDEN FAZLA foreign key
    // ilişkisi bulununca ("Could not embed because more than one
    // relationship was found for 'templates' and 'community_profiles'")
    // hangi FK'yi kullanacağını otomatik seçemiyor — bu ip ucu, embed'in
    // kesin olarak templates.author_id sütunu üzerinden kurulmasını zorlar.
    .select("*, author:community_profiles!author_id(id, username, display_name, avatar_url, is_bot, usage_days_count)")
    .order("created_at", { ascending: false })
    .limit(limit);

  const term = search.trim();
  if (term) query = query.ilike("title", `%${term}%`);
  if (category) query = query.eq("category", category);
  if (tags.length > 0) query = query.overlaps("tags", tags);
  if (authorIds) {
    if (authorIds.length === 0) return []; // "takip edilenler" ama kimseyi takip etmiyor — sorgu bile atmaya gerek yok
    query = query.in("author_id", authorIds);
  }

  const { data, error } = await query;
  if (error) {
    logger.error("COMMUNITY", "Şablonlar getirilemedi", { error: error?.message });
    throw error;
  }

  const templates = data || [];
  const ids = templates.map((t) => t.id);
  let statsById = new Map();
  if (ids.length > 0) {
    const { data: stats, error: statsErr } = await supabase.from("template_stats").select("*").in("template_id", ids);
    if (statsErr) {
      logger.error("COMMUNITY", "Şablon istatistikleri getirilemedi", { error: statsErr?.message });
    } else {
      statsById = new Map((stats || []).map((s) => [s.template_id, s]));
    }
  }

  return templates.map((t) => ({ ...t, stats: statsById.get(t.id) || { like_count: 0, clone_count: 0, comment_count: 0 } }));
}

export async function fetchTemplateById(templateId) {
  const { data, error } = await supabase
    .from("templates")
    // "!author_id" DEĞİŞTİRİLEMEZ bir ip ucu: PostgREST'in şema önbelleğinde
    // templates ↔ community_profiles arasında BİRDEN FAZLA foreign key
    // ilişkisi bulununca ("Could not embed because more than one
    // relationship was found for 'templates' and 'community_profiles'")
    // hangi FK'yi kullanacağını otomatik seçemiyor — bu ip ucu, embed'in
    // kesin olarak templates.author_id sütunu üzerinden kurulmasını zorlar.
    .select("*, author:community_profiles!author_id(id, username, display_name, avatar_url, is_bot, usage_days_count)")
    .eq("id", templateId)
    .single();
  if (error) {
    logger.error("COMMUNITY", "Şablon detayı getirilemedi", { templateId, error: error?.message });
    throw error;
  }
  const { data: stats } = await supabase.from("template_stats").select("*").eq("template_id", templateId).maybeSingle();
  return { ...data, stats: stats || { like_count: 0, clone_count: 0, comment_count: 0 } };
}

// authorProfileId: profiles.id (auth.users.id DEĞİL — bkz. profileService.js).
// title/category/goal/totalDays/previewRoutines/templateTasks artık SIFIRDAN
// YAZILMIYOR — GuidedTemplateForm.jsx kullanıcının kendi mevcut bir planından
// (fetchPlanDetail) türetiyor (bkz. o dosyanın "Aktif/Tamamlanan Plan Seç"
// adımı). Burada yalnızca kaydediliyor.
export async function createTemplate({ authorProfileId, title, category, coverUrl, goal, totalDays, tags, story, previewRoutines, templateTasks }) {
  const { data, error } = await supabase
    .from("templates")
    .insert({
      author_id: authorProfileId,
      title: title.trim(),
      category,
      cover_url: coverUrl,
      goal: goal.trim(),
      total_days: totalDays,
      tags,
      story_impact: story.impact || null,
      story_process: story.process || null,
      story_pros_cons: story.prosCons || null,
      story_tips: story.tips || null,
      story_markdown: story.markdown,
      preview_routines: previewRoutines || [],
      template_tasks: templateTasks || [],
    })
    .select()
    .single();
  if (error) {
    logger.error("COMMUNITY", "Şablon oluşturulamadı", { error: error?.message });
    throw error;
  }
  return data;
}

// "Planlarıma Ekle" — Tek Tıkla Kopyala. AI boru hattını YENİDEN
// TETİKLEMEZ: şablonun kendi `template_tasks`/`preview_routines` alanındaki
// GERÇEK veriden doğrudan yeni bir plan + routines + tasks satırı oluşturur
// (planService.js'teki savePlanToSupabase ile AYNI, zaten var olan
// client-side insert deseni — RLS zaten `plans_insert_own`/`tasks_insert_own`
// ile buna izin veriyor, yeni bir server endpoint gerekmiyor). Anında,
// tam sadakatle bir kopya — kullanıcı "Planlarım"da hemen görür.
// Döner: yeni oluşturulan `plans` satırı (ps.openSavedPlan(plan.id) ile
// doğrudan açılabilir).
export async function cloneTemplateToMyPlans(template, userId) {
  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .insert({
      user_id: userId,
      title: template.title,
      summary: template.goal,
      mode: template.category,
      total_days: template.total_days,
    })
    .select()
    .single();
  if (planErr) {
    logger.error("COMMUNITY", "Klonlanan plan oluşturulamadı", { templateId: template.id, error: planErr?.message });
    throw planErr;
  }

  const routineRows = (template.preview_routines || [])
    .map((r) => ({ plan_id: plan.id, user_id: userId, content: (r.content || "").trim(), frequency: r.frequency || "weekly" }))
    .filter((r) => r.content);
  if (routineRows.length > 0) {
    const { error: routinesErr } = await supabase.from("routines").insert(routineRows);
    if (routinesErr) logger.error("COMMUNITY", "Klonlanan rutinler eklenemedi", { templateId: template.id, error: routinesErr?.message });
  }

  const taskRows = (template.template_tasks || [])
    .map((t) => ({
      plan_id: plan.id,
      user_id: userId,
      week_number: Math.max(1, Number(t.week_number) || 1),
      day_number: Math.max(1, Number(t.day_number) || 1),
      title: (t.title || "").trim() || "İsimsiz görev",
      detail: t.detail || null,
      duration_min: t.duration_min ?? null,
      priority: t.priority || null,
      is_completed: false,
    }))
    .filter((t) => t.title);
  if (taskRows.length > 0) {
    const { error: tasksErr } = await supabase.from("tasks").insert(taskRows);
    if (tasksErr) logger.error("COMMUNITY", "Klonlanan görevler eklenemedi", { templateId: template.id, error: tasksErr?.message });
  }

  return plan;
}

export async function hasLikedTemplate(templateId, profileId) {
  if (!profileId) return false;
  const { data, error } = await supabase
    .from("template_likes")
    .select("template_id")
    .eq("template_id", templateId)
    .eq("user_id", profileId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function toggleLike(templateId, profileId, currentlyLiked) {
  if (currentlyLiked) {
    const { error } = await supabase.from("template_likes").delete().eq("template_id", templateId).eq("user_id", profileId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from("template_likes").insert({ template_id: templateId, user_id: profileId });
  if (error) throw error;
  return true;
}

// "Planlarıma Ekle" tıklandığında sosyal-kanıt olayı — bkz. dosya başı yorumu.
export async function recordTemplateClone(templateId, profileId) {
  const { error } = await supabase.from("template_clones").insert({ template_id: templateId, user_id: profileId });
  if (error) {
    logger.error("COMMUNITY", "Klon olayı kaydedilemedi", { templateId, error: error?.message });
    // Sessizce yut — kullanıcının "Planlarıma Ekle" akışını (plan zaten
    // başlatılıyor) bir istatistik satırının başarısız yazımı KESMEMELİ.
  }
}
