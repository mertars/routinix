import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

// Plan / rutin / görevlerin Supabase kalıcılığı — aiPipelineService'in ürettiği
// (routines + hafta hafta görevler) yeni pipeline yapısına göre.
//
// TABLO ŞEMASI (RLS açık, "user_id = auth.uid()" politikasıyla):
//
//   create table plans (
//     id uuid primary key default gen_random_uuid(),
//     user_id uuid references auth.users not null,
//     title text,
//     summary text,
//     mode text,                       -- "software" | "fitness" | "vacation" | "general"
//     total_days int,                  -- planın kullanıcı hedefine göre toplam gün sayısı
//     created_at timestamptz default now()
//   );
//
//   create table routines (
//     id uuid primary key default gen_random_uuid(),
//     plan_id uuid references plans(id) on delete cascade not null,
//     user_id uuid references auth.users not null,
//     frequency text,                  -- örn. "Günlük" (opsiyonel)
//     content text not null,
//     created_at timestamptz default now()
//   );
//
//   create table tasks (
//     id uuid primary key default gen_random_uuid(),
//     plan_id uuid references plans(id) on delete cascade not null,
//     user_id uuid references auth.users not null,
//     week_number int not null,
//     day_number int not null,
//     title text not null,
//     detail text,
//     duration_min int,               -- görevin tahmini süresi (dk)
//     priority text,                  -- "Yüksek" | "Orta" | "Düşük"
//     estimated_cost text,
//     map_search_query text,
//     is_completed boolean default false,
//     created_at timestamptz default now()
//   );

// aiPipelineService'in gün dizisini ([{ day, title, tasks: [...] }]) düz tasks
// satırlarına çevirir. first_week_tasks ve fetchNextWeekTasks.week_tasks aynı şekli paylaşır.
//
// GÜN ATLAMA KORUMASI: AI bazen bir günü (ör. bir dinlenme/rest günü) boş
// `tasks: []` ile döndürüyor — bu durumda o gün için DB'de HİÇ satır
// oluşmuyordu. PlanBoard.jsx, bir gün numarasının `tasks` tablosunda hiç
// satırı olmamasını "bu hafta henüz üretilmedi" (🔒 kilitli, sonraki hafta
// yüklemesi bekleniyor) ile AYIRT EDEMİYOR — ikisi de aynı şekilde
// görünüyor. Sonuç: o gün kalıcı olarak "kilitli" gösteriliyor, kullanıcı
// hiçbir zaman ona dokunamıyor (hangi günün etkileneceği AI'ın o seferki
// çıktısına bağlı olduğundan planlar arasında 1. gün ya da 2. gün gibi
// rastgele farklı günlerde ortaya çıkıyordu). Kalıcı çözüm: her günün
// EN AZ bir satırı olmasını burada garanti et.
function flattenWeek(weekDays, { planId, userId, weekNumber }) {
  const rows = [];
  for (const dayObj of weekDays || []) {
    const dayNumber = dayObj.day ?? dayObj.day_number ?? null;
    if (!dayObj.tasks || dayObj.tasks.length === 0) {
      rows.push({
        plan_id: planId,
        user_id: userId,
        week_number: weekNumber,
        day_number: dayNumber,
        title: "Dinlenme / Serbest Gün",
        detail: "Bu gün için planlanmış özel bir görev yok — dinlenmek ya da serbest zaman geçirmek için iyi bir fırsat.",
        duration_min: null,
        priority: null,
        estimated_cost: null,
        map_search_query: null,
        is_completed: false,
      });
      continue;
    }
    for (const t of dayObj.tasks || []) {
      rows.push({
        plan_id: planId,
        user_id: userId,
        week_number: weekNumber,
        day_number: dayNumber,
        // title NOT NULL olabilir — asla boş bırakma.
        title: (t.title ?? "").toString().trim() || "İsimsiz görev",
        detail: t.detail ?? t.description ?? null,
        duration_min: t.duration_min ?? t.minutes ?? null,
        priority: t.priority ?? null,
        estimated_cost: t.estimated_cost ?? null,
        map_search_query: t.map_search_query ?? null,
        is_completed: false,
      });
    }
  }
  return rows;
}

// createEnrichedPlan çıktısını kaydeder: plan + rutinler + 1. hafta görevleri.
//   aiOutput: { plan_title, plan_summary, routines: [...], first_week_tasks: [...] }
// Döner: { plan, routines, tasks } — tasks satırları (id'leriyle) tamamlama için gerekli.
export async function savePlanToSupabase(aiOutput, userId, mode) {
  if (!aiOutput) throw new Error("Kaydedilecek plan verisi (aiOutput) boş.");
  if (!userId) throw new Error("Plan kaydı için oturum (userId) gerekli.");

  // 1) Ana plan
  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .insert({
      user_id: userId,
      mode,
      // title NOT NULL olabilir — güvenli varsayılan ver.
      title: (aiOutput.plan_title ?? aiOutput.title ?? "").toString().trim() || "İsimsiz Plan",
      summary: aiOutput.plan_summary ?? aiOutput.summary ?? null,
      total_days: Number.isFinite(Number(aiOutput.total_days)) ? Number(aiOutput.total_days) : null,
      // Haftalık iskelet (bkz. api/_lib/planPrompt.js) — OPSİYONEL: model
      // üretmediyse/eski bir çağrıdan geldiyse null kalır, sonraki hafta
      // üretimi (loadNextWeek) bunu zaten "varsa kullan" mantığıyla ele alır.
      week_topics: Array.isArray(aiOutput.week_topics) && aiOutput.week_topics.length > 0 ? aiOutput.week_topics : null,
    })
    .select()
    .single();
  if (planErr) {
    logger.error("SUPABASE", "Plan kaydedilemedi (total_days dahil)", { table: "plans", action: "insert", error: planErr });
    throw planErr;
  }

  // 2) Rutinler (varsa) — toplu insert. Rutin string ya da {frequency, content}
  //    olabilir. frequency ve content NOT NULL kolonlar olduğu için varsayılan
  //    değerlerle boş kalmamaları garantiye alınır.
  let routines = [];
  if (Array.isArray(aiOutput.routines) && aiOutput.routines.length > 0) {
    const routineRows = aiOutput.routines
      .map((r) => {
        const isObj = r && typeof r === "object";
        const content = (isObj ? r.content : r) ?? "";
        return {
          plan_id: plan.id,
          user_id: userId,
          frequency: (isObj ? r.frequency : null) || "weekly",
          content: String(content).trim() || "Genel rutin",
        };
      })
      .filter((row) => row.content); // tamamen boş içerikli rutinleri atla
    if (routineRows.length > 0) {
      const { data, error } = await supabase.from("routines").insert(routineRows).select();
      if (error) {
        logger.error("SUPABASE", "Rutinler kaydedilemedi", { table: "routines", action: "insert", planId: plan.id, error });
        throw error;
      }
      routines = data || [];
    }
  }

  // 3) 1. hafta görevleri (varsa) — toplu insert, satırları id'leriyle geri al.
  let tasks = [];
  const taskRows = flattenWeek(aiOutput.first_week_tasks, { planId: plan.id, userId, weekNumber: 1 });
  if (taskRows.length > 0) {
    const { data, error } = await supabase.from("tasks").insert(taskRows).select();
    if (error) {
      logger.error("SUPABASE", "1. hafta görevleri kaydedilemedi", { table: "tasks", action: "insert", planId: plan.id, error });
      throw error;
    }
    tasks = data || [];
  }

  return { plan, routines, tasks };
}

// "Kendi Planını Hazırla" (ManualPlanBuilder.jsx) — savePlanToSupabase'in AI
// ÇIKTISI olmadan çalışan eşdeğeri. Gemini'ye HİÇ gidilmez, bu yüzden
// savePlanToSupabase'in "yalnızca 1. haftayı kaydet" (lazy-loading) kısıtı
// BURADA YOK — kullanıcı kaç gün girdiyse (3'ten 365'e) TÜMÜ TEK SEFERDE
// yazılır; zaten AI maliyeti olmadığından "sonraki haftayı sonra üret"
// mantığının hiçbir anlamı kalmıyor.
//
// builder: { title, totalDays, days: { [dayNumber]: [{ title, duration_min,
//   priority, estimated_cost, map_search_query }] }, category, routines:
//   string[] } — ManualPlanBuilder.jsx'in yerel state'i, kaydetmeden hemen
//   önce boş başlıklı satırlar zaten filtrelenmiş olarak gelir.
// Döner: { plan, routines, tasks } — routines, savePlanToSupabase'deki
// AYNI desenle (frequency/content NOT NULL, güvenli varsayılanlarla) yazılır.
export async function saveManualPlanToSupabase(builder, userId) {
  if (!userId) throw new Error("Plan kaydı için oturum (userId) gerekli.");

  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .insert({
      user_id: userId,
      mode: builder.category,
      title: (builder.title ?? "").toString().trim() || "Kendi Planım",
      total_days: Number.isFinite(Number(builder.totalDays)) ? Number(builder.totalDays) : null,
    })
    .select()
    .single();
  if (planErr) {
    logger.error("SUPABASE", "Manuel plan kaydedilemedi", { table: "plans", action: "insert", error: planErr });
    throw planErr;
  }

  // Rutinler (varsa) — Studio Builder'ın Rutin Kartları'ndan gelir:
  // {content, frequency}[], kart sırası array index'i olarak sort_order'a
  // yazılır (görevlerle AYNI ilke, bkz. aşağıdaki taskRows). Elle girilen
  // rutinler günlük tekrar niyetiyle yazıldığı için (AI akışının "weekly"
  // varsayılanının aksine) burada "daily" varsayılan.
  let routines = [];
  if (Array.isArray(builder.routines) && builder.routines.length > 0) {
    const routineRows = builder.routines
      .map((r, idx) => ({
        plan_id: plan.id,
        user_id: userId,
        frequency: (typeof r === "object" ? r.frequency : null) || "daily",
        content: String((typeof r === "object" ? r.content : r) ?? "").trim(),
        sort_order: idx,
      }))
      .filter((row) => row.content);
    if (routineRows.length > 0) {
      let { data, error } = await supabase.from("routines").insert(routineRows).select();
      // routines.sort_order (bkz. supabase/routine_sort_order.sql) HENÜZ
      // çalıştırılmamış bir migration olabilir — tasks.sort_order İLE AYNI
      // fail-open ilkesi.
      if (error?.code === "PGRST204") {
        logger.warn("SUPABASE", "routines.sort_order sütunu henüz yok (migration çalıştırılmamış) — sort_order'sız kaydediliyor", { error: error.message });
        const withoutSortOrder = routineRows.map(({ sort_order, ...rest }) => rest);
        ({ data, error } = await supabase.from("routines").insert(withoutSortOrder).select());
      }
      if (error) {
        logger.error("SUPABASE", "Manuel plan rutinleri kaydedilemedi", { table: "routines", action: "insert", planId: plan.id, error });
        throw error;
      }
      routines = data || [];
    }
  }

  // Gün bazlı satırları düz bir insert payload'ına çevir — flattenWeek ile
  // AYNI alan adları/week_number formülü (day/7'ye yuvarla) kullanılır ki
  // week_number'a göre gruplayan mevcut kod (usePlanStudio.groupTasksToWeeks)
  // bu planı AI'lı bir plandan AYIRT EDEMESİN.
  const taskRows = [];
  for (const [dayKey, dayTasks] of Object.entries(builder.days || {})) {
    const dayNumber = Math.max(1, Number(dayKey) || 1);
    (dayTasks || []).forEach((t, idx) => {
      const title = (t.title ?? "").toString().trim();
      if (!title) return;
      taskRows.push({
        plan_id: plan.id,
        user_id: userId,
        week_number: Math.max(1, Math.ceil(dayNumber / 7)),
        day_number: dayNumber,
        title,
        detail: t.detail ?? null,
        duration_min: t.duration_min ?? null,
        priority: t.priority ?? null,
        estimated_cost: t.estimated_cost ?? null,
        map_search_query: t.map_search_query ?? null,
        is_completed: false,
        widgets: t.widgets ?? [],
        // Builder'daki sürükle-bırak sırası — array index'i BİREBİR yazılır
        // (bkz. supabase/task_sort_order.sql + fetchPlanDetail/
        // fetchDashboardData'nın ikincil .order("sort_order") sorgusu).
        sort_order: idx,
      });
    });
  }

  let tasks = [];
  if (taskRows.length > 0) {
    let { data, error } = await supabase.from("tasks").insert(taskRows).select();
    // sort_order (bkz. supabase/task_sort_order.sql) VE widgets (bkz.
    // supabase/task_widgets.sql) İKİSİ de SONRADAN eklenen, henüz
    // ÇALIŞTIRILMAMIŞ olabilecek migration'lar — PostgREST eksik bir sütunu
    // "şema önbelleğinde yok" (PGRST204) hatasıyla reddeder. Hangisi (ya da
    // ikisi BİRDEN) eksik olursa olsun planın TAMAMEN kaydedilememesi
    // YERİNE (o alan/alanlar henüz kalıcı olmasa bile) İKİSİ de çıkarılıp
    // tekrar denenir — aynı fail-open ilkesi: eksik bir migration,
    // kullanıcının GERÇEK planını kaydetmesini ASLA engellememeli.
    if (error?.code === "PGRST204") {
      logger.warn("SUPABASE", "tasks.sort_order/widgets sütunlarından biri henüz yok (migration çalıştırılmamış) — onlarsız kaydediliyor", { error: error.message });
      const stripped = taskRows.map(({ sort_order, widgets, ...rest }) => rest);
      ({ data, error } = await supabase.from("tasks").insert(stripped).select());
    }
    if (error) {
      logger.error("SUPABASE", "Manuel plan görevleri kaydedilemedi", { table: "tasks", action: "insert", planId: plan.id, error });
      throw error;
    }
    tasks = data || [];
  }

  return { plan, routines, tasks };
}

// Sonraki bir haftanın görevlerini kaydeder (lazy-load devamı). Döner: task satırları.
//   weekTasks: fetchNextWeekTasks(...).week_tasks
export async function saveWeekTasks(planId, userId, weekNumber, weekTasks) {
  const taskRows = flattenWeek(weekTasks, { planId, userId, weekNumber });
  if (taskRows.length === 0) return [];
  const { data, error } = await supabase.from("tasks").insert(taskRows).select();
  if (error) {
    logger.error("SUPABASE", `${weekNumber}. hafta görevleri kaydedilemedi`, { table: "tasks", action: "insert", planId, weekNumber, error });
    throw error;
  }
  return data || [];
}

// Bir görevin tamamlanma durumunu günceller.
export async function setTaskCompleted(taskId, isCompleted) {
  const { error } = await supabase.from("tasks").update({ is_completed: isCompleted }).eq("id", taskId);
  if (error) {
    logger.error("SUPABASE", "Görev durumu güncellenemedi", { table: "tasks", action: "update", taskId, error });
    throw error;
  }
}

// Bir görevin widget dizisini (bkz. src/utils/taskWidgets.js) günceller —
// is_completed İLE AYNI güven seviyesinde, doğrudan istemciden yazılabilen
// tek diğer sütun (bkz. supabase/task_widgets.sql'deki güvenlik notu).
export async function setTaskWidgets(taskId, widgets) {
  const { error } = await supabase.from("tasks").update({ widgets }).eq("id", taskId);
  if (error) {
    logger.error("SUPABASE", "Görev widget'ları güncellenemedi", { table: "tasks", action: "update", taskId, error });
    throw error;
  }
}

// Dinamik Gün/Tarih Bağlama — Tarih Kaydırma (Cascading Shift, bkz.
// usePlanStudio.shiftPlanStartDate/utils/planDate.js). `plans` tablosu
// tasks'ın aksine sütun bazlı GRANT kısıtı TAŞIMAZ (yalnızca RLS
// `plans_update_own`) — bu yüzden is_completed/widgets'taki gibi bir
// service_role turuna gerek yok, sahibi doğrudan kendi planının
// start_date'ini güncelleyebilir.
export async function updatePlanStartDate(planId, newStartDate) {
  const { error } = await supabase.from("plans").update({ start_date: newStartDate }).eq("id", planId);
  if (error) {
    logger.error("SUPABASE", "Planın başlangıç tarihi güncellenemedi", { table: "plans", action: "update", planId, error });
    throw error;
  }
}

// Toplu widget atamasında (bkz. usePlanStudio.batchApplyWidgets) hiç görevi
// OLMAYAN bir güne widget eklenmek istendiğinde çağrılır — TEK, minimal bir
// "taslak" görev satırı oluşturur (kullanıcı başlığını sonra kendi düzenler).
// GÜVENLİK: bu, AŞAĞIDAKİ notta bahsedilen "AI Koç'un yüksek yetkili toplu
// mutasyonu" DEĞİL — saveManualPlanToSupabase/saveWeekTasks İLE AYNI, RLS
// `tasks_insert_own` politikasıyla zaten kısıtlı, kullanıcının KENDİ
// başlattığı normal bir "yeni görev ekle" eylemi; doğrudan istemciden
// (service_role turu GEREKMEDEN) yapılabilir.
export async function createDraftTask(planId, userId, weekNumber, dayNumber, widgets) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      plan_id: planId,
      user_id: userId,
      week_number: weekNumber,
      day_number: dayNumber,
      title: "Yeni Görev",
      is_completed: false,
      widgets: widgets || [],
    })
    .select()
    .single();
  if (error) {
    logger.error("SUPABASE", "Taslak görev oluşturulamadı", { table: "tasks", action: "insert", planId, dayNumber, error });
    throw error;
  }
  return data;
}

// GÜVENLİK NOTU: updateTasksBulk / insertTasks fonksiyonları buradan
// KALDIRILDI — AI Koç'un "yüksek yetkili" görev mutasyonları (duration_min,
// priority, day_number, yeni görev ekleme) artık YALNIZCA api/coach-action.js
// (Vercel serverless function, service_role) üzerinden yapılıyor. Client
// (anon key), Supabase RLS + kolon bazlı GRANT ile tasks tablosunda yalnızca
// kendi is_completed alanını değiştirebilir ve satır silemez (bkz.
// supabase/migration.sql "tasks" bölümü). Bu iki fonksiyonu buradan silmek,
// birinin yanlışlıkla client'tan tekrar çağırmasını da mimari olarak engeller.

// Bir planı siler. FK'lar ON DELETE CASCADE olduğu için ilgili routines/tasks
// satırları da otomatik silinir.
export async function deletePlan(planId) {
  const { error } = await supabase.from("plans").delete().eq("id", planId);
  if (error) {
    logger.error("SUPABASE", "Plan silinemedi", { table: "plans", action: "delete", planId, error });
    throw error;
  }
}

// tasks.sort_order YENİ bir sütun (bkz. supabase/task_sort_order.sql) —
// bu migration Supabase'de henüz ÇALIŞTIRILMAMIŞ olabilir. Sorgu önce bu
// sütunla sıralamayı dener; PostgREST "sütun yok" hatası (42703,
// undefined_column) dönerse SESSİZCE sütunsuz haliyle tekrar dener —
// migration'ın çalıştırılıp çalıştırılmadığından TAMAMEN BAĞIMSIZ olarak
// uygulama asla çökmez (aynı fail-open ilkesi, bkz. api/_lib/
// planRateLimit.js). `queryFactory` HER ÇAĞRIDA TAZE bir query builder
// döndürmeli — Supabase'in builder'ları .order() ile MUTATE olduğundan
// aynı örneği iki kez kullanmak ilk denemenin sıralamasını taşırdı.
async function selectTasksOrdered(queryFactory) {
  const withSort = await queryFactory().order("sort_order", { ascending: true, nullsFirst: false });
  if (withSort.error?.code === "42703") {
    logger.warn("SUPABASE", "tasks.sort_order sütunu henüz yok (migration çalıştırılmamış) — sıralamasız devam ediliyor", { error: withSort.error.message });
    return queryFactory();
  }
  return withSort;
}

// routines.sort_order İÇİN AYNI fail-open ilkesi (bkz. selectTasksOrdered) —
// Rutin Kartları'nın sürükle-bırak sırası routine_sort_order.sql
// ÇALIŞTIRILMAMIŞ olsa bile Rutinler'in çekilmesini ASLA engellemez.
// created_at İKİNCİL sıralama olarak KALIR: sort_order eşit/null olan
// (ör. eski, migration öncesi) satırlar arasında yine tutarlı bir sıra verir.
async function selectRoutinesOrdered(queryFactory) {
  const withSort = await queryFactory()
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (withSort.error?.code === "42703") {
    logger.warn("SUPABASE", "routines.sort_order sütunu henüz yok (migration çalıştırılmamış) — sıralamasız devam ediliyor", { error: withSort.error.message });
    return queryFactory().order("created_at", { ascending: true });
  }
  return withSort;
}

// "Bugünün Görevleri" popover'ı için: kullanıcının TÜM planlarını + tüm
// rutinlerini + tüm görevlerini 3 sorguda çekip plana göre gruplar.
// Döner: [{ ...plan, routines: [...], tasks: [...] }]
export async function fetchDashboardData(userId) {
  const [plansRes, routinesRes, tasksRes] = await Promise.all([
    supabase.from("plans").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    selectRoutinesOrdered(() => supabase.from("routines").select("*").eq("user_id", userId)),
    selectTasksOrdered(() => supabase.from("tasks").select("*").eq("user_id", userId).order("week_number", { ascending: true })),
  ]);
  if (plansRes.error) {
    logger.error("SUPABASE", "Planlar çekilemedi (dashboard)", { table: "plans", action: "select", userId, error: plansRes.error });
    throw plansRes.error;
  }
  if (routinesRes.error) {
    logger.error("SUPABASE", "Rutinler çekilemedi (dashboard)", { table: "routines", action: "select", userId, error: routinesRes.error });
    throw routinesRes.error;
  }
  if (tasksRes.error) {
    logger.error("SUPABASE", "Görevler çekilemedi (dashboard)", { table: "tasks", action: "select", userId, error: tasksRes.error });
    throw tasksRes.error;
  }

  const routinesByPlan = {};
  for (const r of routinesRes.data || []) (routinesByPlan[r.plan_id] = routinesByPlan[r.plan_id] || []).push(r);
  const tasksByPlan = {};
  for (const t of tasksRes.data || []) (tasksByPlan[t.plan_id] = tasksByPlan[t.plan_id] || []).push(t);

  return (plansRes.data || []).map((p) => ({
    ...p,
    routines: routinesByPlan[p.id] || [],
    tasks: tasksByPlan[p.id] || [],
  }));
}

// Belirli id'lere sahip görevlerin YALNIZCA başlıklarını getirir — WeeklyFlowModal
// "Şampiyon Rutin" slaytında focus_sessions.task_id'den gelen id'leri okunabilir
// başlıklara çevirmek için. Embed (`tasks(title)`) yerine bilerek AYRI bir sorgu:
// communityService.js'teki template_stats deseniyle aynı sebep — PostgREST
// embed'i tetiklemeden, küçük/hedefli bir `in (...)` sorgusu.
export async function fetchTasksByIds(userId, taskIds) {
  const ids = [...new Set(taskIds)].filter(Boolean);
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("tasks").select("id, title").eq("user_id", userId).in("id", ids);
  if (error) {
    logger.error("SUPABASE", "Görev başlıkları getirilemedi", { table: "tasks", action: "select", userId, error });
    return [];
  }
  return data || [];
}

// Kullanıcının kayıtlı planlarını (özet) getirir — "Planlarım" listesi için.
export async function fetchUserPlans(userId) {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    logger.error("SUPABASE", "Planlar çekilemedi", { table: "plans", action: "select", userId, error });
    throw error;
  }
  return data || [];
}

// Tek bir planın tüm detayını (rutinler + tüm görevler) getirir — planı yeniden açmak için.
export async function fetchPlanDetail(planId) {
  const [{ data: plan, error: pErr }, routinesRes, tasksRes] = await Promise.all([
    supabase.from("plans").select("*").eq("id", planId).single(),
    selectRoutinesOrdered(() => supabase.from("routines").select("*").eq("plan_id", planId)),
    selectTasksOrdered(() => supabase.from("tasks").select("*").eq("plan_id", planId).order("week_number", { ascending: true })),
  ]);
  if (pErr) {
    logger.error("SUPABASE", "Plan detayı çekilemedi", { table: "plans", action: "select", planId, error: pErr });
    throw pErr;
  }
  if (routinesRes.error) {
    logger.error("SUPABASE", "Plan rutinleri çekilemedi", { table: "routines", action: "select", planId, error: routinesRes.error });
    throw routinesRes.error;
  }
  if (tasksRes.error) {
    logger.error("SUPABASE", "Plan görevleri çekilemedi", { table: "tasks", action: "select", planId, error: tasksRes.error });
    throw tasksRes.error;
  }
  return { plan, routines: routinesRes.data || [], tasks: tasksRes.data || [] };
}
