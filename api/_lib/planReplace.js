// Plan Studio & Editor Engine — mevcut bir planı Studio Builder'da düzenleyip
// "Değişiklikleri Kaydet"e basınca burası çalışır. GÜVENLİK GEREKÇESİ (bkz.
// planService.js'teki "GÜVENLİK NOTU"): client (anon key) tasks tablosunda
// yalnızca kendi is_completed alanını değiştirebilir, satır SİLEMEZ — bu
// yüzden "planı düzenle" gibi görev satırlarını TOPTAN silip yeniden yazan
// bir işlem yalnızca service_role (bu dosya, api/plan-edit.js üzerinden)
// yapılabilir; coach-action.js/planDelta.js İLE AYNI mimari ilke.
//
// TASARIM: kısmi diff YERİNE tam değiştirme (delete-all + insert-all).
// Studio Builder zaten TÜM planı formda tutuyor (bir "değişen alanlar"
// deltası değil) — bu yüzden silme+yeniden-yazma, silinen/yeniden
// sıralanan/birleştirilen görevlerin eski id'leriyle YANLIŞ eşleşmesi gibi
// bir hata sınıfını YAPISAL olarak imkansız kılar. Bilinen kısıt: bu iki
// silme+ekleme çifti bir DB transaction'ı İÇİNDE DEĞİL (bu kod tabanında
// hiçbir çoklu-adım yazma işlemi transaction kullanmıyor, bkz. planDelta.js)
// — ilk insert başarısız olursa plan geçici olarak boş görev/rutin listesiyle
// kalabilir; kullanıcı tekrar "Kaydet"e bastığında düzelir.
export async function replacePlanContents(admin, plan, userId, builder) {
  const { data: updatedPlan, error: planErr } = await admin
    .from("plans")
    .update({
      title: (builder.title ?? "").toString().trim() || "Kendi Planım",
      total_days: Number.isFinite(Number(builder.totalDays)) ? Number(builder.totalDays) : plan.total_days,
    })
    .eq("id", plan.id)
    .select()
    .single();
  if (planErr) throw planErr;

  // --- Görevler: TAMAMEN değiştir ---
  const { error: delTasksErr } = await admin.from("tasks").delete().eq("plan_id", plan.id);
  if (delTasksErr) throw delTasksErr;

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
        // Kullanıcının önceki ilerlemesi KORUNUR: builder'daki her görev,
        // düzenlenmeden önce DB'den yüklendiğinde is_completed'ını yolcu
        // olarak taşımış olabilir (bkz. ManualPlanBuilder.jsx pre-fill
        // useState). Yalnızca GERÇEKTEN yeni eklenen görevler (bu alanı hiç
        // taşımayanlar) false'a düşer — "düzenle" akışı asla sessizce
        // tamamlanma geçmişini SIFIRLAMAZ.
        is_completed: t.is_completed ?? false,
        // is_completed İLE AYNI koruma mantığı: builder'daki her görev, bu
        // planı düzenlemeden ÖNCE DB'den yüklenirken widget'larını yolcu
        // olarak taşımış olabilir (bkz. ManualPlanBuilder.jsx'in daysData
        // pre-fill useState'i) — taşınmazsa PlanBoard'da eklenen widget'lar
        // her "Değişiklikleri Kaydet" sonrası SESSİZCE SİLİNİRDİ (bu fonksiyon
        // delete-all+insert-all yapıyor).
        widgets: t.widgets ?? [],
        sort_order: idx,
      });
    });
  }
  let tasks = [];
  if (taskRows.length > 0) {
    let { data, error } = await admin.from("tasks").insert(taskRows).select();
    // tasks.sort_order (bkz. supabase/task_sort_order.sql) VE tasks.widgets
    // (bkz. supabase/task_widgets.sql) İKİSİ de SONRADAN eklenen, HENÜZ
    // çalıştırılmamış olabilecek migration'lar — client tarafındaki AYNI
    // fail-open ilkesi (bkz. planService.saveManualPlanToSupabase) burada da
    // geçerli: eksik bir migration, kullanıcının GERÇEK düzenlemesini
    // kaydetmesini ASLA engellememeli.
    if (error?.code === "PGRST204") {
      const stripped = taskRows.map(({ sort_order, widgets, ...rest }) => rest);
      ({ data, error } = await admin.from("tasks").insert(stripped).select());
    }
    if (error) throw error;
    tasks = data || [];
  }

  // --- Rutinler: TAMAMEN değiştir ---
  const { error: delRoutinesErr } = await admin.from("routines").delete().eq("plan_id", plan.id);
  if (delRoutinesErr) throw delRoutinesErr;

  const routineRows = (builder.routines || [])
    .map((r, idx) => ({
      plan_id: plan.id,
      user_id: userId,
      content: String(r?.content ?? "").trim(),
      frequency: r?.frequency || "daily",
      sort_order: idx,
    }))
    .filter((r) => r.content);
  let routines = [];
  if (routineRows.length > 0) {
    let { data, error } = await admin.from("routines").insert(routineRows).select();
    // routines.sort_order (bkz. supabase/routine_sort_order.sql) İÇİN AYNI
    // fail-open ilkesi.
    if (error?.code === "PGRST204") {
      const withoutSortOrder = routineRows.map(({ sort_order, ...rest }) => rest);
      ({ data, error } = await admin.from("routines").insert(withoutSortOrder).select());
    }
    if (error) throw error;
    routines = data || [];
  }

  return { plan: updatedPlan, tasks, routines };
}
