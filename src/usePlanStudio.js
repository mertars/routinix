import { useState, useEffect, useCallback, useMemo, startTransition } from "react";
import {
  categoryOf,
  STAGE_INTRO,
  STAGE_WIZARD,
  STAGE_LOADING,
  STAGE_ERROR,
  STAGE_PLAN,
  MIN_GOAL_LENGTH,
  FALLBACK_QUESTIONS,
  isLikelyGibberish,
  AI_GATE_MESSAGE,
} from "./constants";
import { generateOnboardingQuestions, createEnrichedPlan, fetchNextWeekTasks } from "./services/aiPipelineService";
import {
  savePlanToSupabase,
  saveWeekTasks,
  saveManualPlanToSupabase,
  setTaskCompleted as setTaskCompletedSvc,
  setTaskWidgets as setTaskWidgetsSvc,
  createDraftTask as createDraftTaskSvc,
  updatePlanStartDate as updatePlanStartDateSvc,
  fetchUserPlans,
  fetchPlanDetail,
  deletePlan as deletePlanSvc,
} from "./services/planService";
import { callCoachAction } from "./services/coachActionService";
import { updateManualPlanInSupabase } from "./services/planEditService";
import { setHapticsEnabled } from "./lib/haptics";
import logger from "./utils/logger";
import { runWhenIdle } from "./utils/idle";
import { createWidget } from "./utils/taskWidgets";
import { shiftStartDateForDay } from "./utils/planDate";
import { detectSmartContext, injectSmartWidgets, getSmartWidgetBadges, buildStrategicAnalysis } from "./utils/smartWidgets";

// Yalnızca `taskId`'nin ait olduğu hafta/gün nesnesini yeniden oluşturup
// içindeki tek görevi `patch` ile güncelleyen SAF (pure) yardımcı —
// toggleTask/updateTaskWidgets İKİSİ de bunu paylaşır. Dokunulmayan hafta/
// gün/görev referansları AYNEN korunur (bkz. toggleTask'ın altındaki
// performans yorumu — memoized TaskCard'ların gereksiz re-render'ı
// atlayabilmesi buna bağlı).
function patchTaskInWeeks(weeks, taskId, patch) {
  for (const w of weeks) {
    const dayIdx = w.days.findIndex((d) => d.tasks.some((t) => t.id === taskId));
    if (dayIdx === -1) continue;
    const day = w.days[dayIdx];
    const taskIdx = day.tasks.findIndex((t) => t.id === taskId);
    const nextTasks = day.tasks.slice();
    nextTasks[taskIdx] = { ...nextTasks[taskIdx], ...patch };
    const nextDay = { ...day, tasks: nextTasks };
    const nextDays = w.days.slice();
    nextDays[dayIdx] = nextDay;
    const nextWeek = { ...w, days: nextDays };
    return weeks.map((ww) => (ww === w ? nextWeek : ww));
  }
  return weeks;
}

// Yeni oluşturulan bir görev satırını (bkz. batchApplyWidgets'ın boş günler
// için oluşturduğu taslak görev) doğru hafta/gün nesnesine EKLEYEN SAF
// yardımcı. Hedef hafta YOKSA (normalde erişilmez — batchApplyWidgets
// yalnızca zaten yüklü/kilitsiz günleri hedefler) hiçbir şey yapmadan
// weeks'i AYNEN döner.
function addTaskToWeeks(weeks, weekNumber, dayNumber, newTask) {
  const weekIdx = weeks.findIndex((w) => w.weekNumber === weekNumber);
  if (weekIdx === -1) return weeks;
  const week = weeks[weekIdx];
  const dayIdx = week.days.findIndex((d) => d.dayNumber === dayNumber);
  let nextDays;
  if (dayIdx === -1) {
    nextDays = [...week.days, { dayNumber, tasks: [newTask] }].sort((a, b) => a.dayNumber - b.dayNumber);
  } else {
    nextDays = week.days.slice();
    nextDays[dayIdx] = { ...nextDays[dayIdx], tasks: [...nextDays[dayIdx].tasks, newTask] };
  }
  const nextWeeks = weeks.slice();
  nextWeeks[weekIdx] = { ...week, days: nextDays };
  return nextWeeks;
}

// DB'den gelen düz tasks satırlarını haftalara/günlere gruplar.
// [{ weekNumber, days: [{ dayNumber, tasks: [row...] }] }] (hafta & gün sıralı)
function groupTasksToWeeks(taskRows) {
  const byWeek = new Map();
  for (const t of taskRows || []) {
    const wk = t.week_number ?? 1;
    if (!byWeek.has(wk)) byWeek.set(wk, new Map());
    const byDay = byWeek.get(wk);
    const dn = t.day_number ?? 0;
    if (!byDay.has(dn)) byDay.set(dn, []);
    byDay.get(dn).push(t);
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, byDay]) => ({
      weekNumber,
      days: [...byDay.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([dayNumber, tasks]) => ({ dayNumber, tasks })),
    }));
}

// Tüm global durum + yeni pipeline akışı (create → save → hafta hafta lazy-load).
// AI çağrıları (createEnrichedPlan / fetchNextWeekTasks) ve DB kalıcılığı
// (savePlanToSupabase / saveWeekTasks) burada tetiklenir; App/bileşenler yalnızca
// bu hook'un döndürdüğü değerleri ve aksiyonları kullanır.
export default function usePlanStudio({ user, onRequireAuth } = {}) {
  const [category, setCategory] = useState("software");
  const [goal, setGoal] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [stage, setStage] = useState(STAGE_INTRO);
  const [errorMsg, setErrorMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [remindersOn, setRemindersOn] = useState(true);
  // Ses & dokunsal geri bildirim — varsayılan AÇIK. Modül seviyesindeki
  // haptics bayrağıyla senkron tutulur.
  const [hapticsOn, setHapticsOn] = useState(true);

  // Dinamik onboarding — kategori+hedefe göre üretilen sorular + cevaplar.
  const [questions, setQuestions] = useState([]); // [{ title, type, options }]
  const [answers, setAnswers] = useState({}); // { [soruIndex]: cevap }
  const [wizardStep, setWizardStep] = useState(0);

  // Aktif plan (ekranda açık olan) — hem yeni üretilen hem DB'den açılan.
  const [dbPlan, setDbPlan] = useState(null); // { id, title, summary, mode }
  const [routines, setRoutines] = useState([]); // routines satırları ({ content, frequency })
  const [weeks, setWeeks] = useState([]); // groupTasksToWeeks çıktısı
  const [loadingNextWeek, setLoadingNextWeek] = useState(false);
  const [nextWeekError, setNextWeekError] = useState("");
  // Stratejik Başarı Kartı (bkz. PlanGeneratedSummaryModal.jsx) — YENİ bir AI
  // planı üretilip kaydedildiğinde finalizeAndGenerate tarafından doldurulur;
  // { analysisText, widgetBadges } | null. PlanBoard ZATEN mount olur, bu
  // modal onun ÜZERİNDE bir overlay olarak açılır — "Anladım, Planı Başlat"a
  // kadar kullanıcı takvimi net göremez.
  const [planSummary, setPlanSummary] = useState(null);
  const [planSummaryOpen, setPlanSummaryOpen] = useState(false);

  // "Planlarım" — oturum açıksa DB'den çekilen kayıtlı planların özeti.
  const [savedPlans, setSavedPlans] = useState([]);

  // Şablon Keşfet'ten "Şablonu Kullan" ile gelen kesin gün sayısı — AI'ın
  // total_days tahminini ezmek için finalizeAndGenerate'de kullanılır.
  const [templateDaysOverride, setTemplateDaysOverride] = useState(null);

  // "Kendi Planını Hazırla" (ManualPlanBuilder.jsx) — CategoryIntro'daki
  // merkez neon buton bunu açar. AI boru hattından TAMAMEN bağımsız.
  const [manualBuilderOpen, setManualBuilderOpen] = useState(false);
  // Plan Studio & Editor Engine — "Planı Düzenle" ile açıldığında dolu,
  // "Kendi Planını Hazırla" ile açıldığında null. `editLoading`, planId
  // verilip builder açılana kadarki kısa fetchPlanDetail penceresini kapsar
  // (bkz. openManualBuilder) — builder HER ZAMAN ya boş ya da TAM dolu
  // veriyle mount edilir, ara/eksik bir durumla asla mount edilmez.
  const [editingPlanPayload, setEditingPlanPayload] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const mode = categoryOf(category);

  // Toggle değişince modül seviyesindeki haptics bayrağını senkronla.
  useEffect(() => {
    setHapticsEnabled(hapticsOn);
  }, [hapticsOn]);

  const refreshSavedPlans = useCallback(async () => {
    if (!user) {
      setSavedPlans([]);
      return;
    }
    try {
      setSavedPlans(await fetchUserPlans(user.id));
    } catch (err) {
      logger.error("PLANS", "Kayıtlı planlar getirilemedi", { error: err?.message });
    }
  }, [user]);

  useEffect(() => {
    refreshSavedPlans();
  }, [refreshSavedPlans]);

  const goalTrimmed = goal.trim();
  const goalTooShort = goalTrimmed.length > 0 && goalTrimmed.length < MIN_GOAL_LENGTH;
  const canStart = goalTrimmed.length >= MIN_GOAL_LENGTH;

  const handleCategoryChange = useCallback((key) => setCategory(key), []);

  const resetToIntro = useCallback(() => {
    setStage(STAGE_INTRO);
    refreshSavedPlans();
  }, [refreshSavedPlans]);

  const startNewPlan = useCallback(() => {
    setMenuOpen(false);
    setGoal("");
    setExtraNote("");
    setErrorMsg("");
    setDbPlan(null);
    setRoutines([]);
    setWeeks([]);
    setQuestions([]);
    setAnswers({});
    setWizardStep(0);
    setTemplateDaysOverride(null);
    setPlanSummary(null);
    setPlanSummaryOpen(false);
    setStage(STAGE_INTRO);
  }, []);

  const closePlanSummary = useCallback(() => setPlanSummaryOpen(false), []);

  // Ortak: verilen kategori/hedef için dinamik onboarding sorularını üretip
  // wizard'a geçer. startOnboarding (manuel "Başla") ve startFromTemplate
  // (Şablon Keşfet) bunu paylaşır.
  const beginOnboarding = useCallback(async (cat, goalText) => {
    setErrorMsg("");
    setAnswers({});
    setWizardStep(0);
    setStage(STAGE_LOADING);
    try {
      const qs = await generateOnboardingQuestions({ category: cat, goal: goalText });
      setQuestions(qs);
    } catch (err) {
      logger.warn("ONBOARDING", "Sorular üretilemedi, yedek anket kullanılıyor", { error: err?.message });
      setQuestions(FALLBACK_QUESTIONS); // dead-end olmasın: güvenli yedek
    }
    setStage(STAGE_WIZARD);
  }, []);

  // ---- ADIM 1: Intro "Devam Et" → auth gate → dinamik soruları üret → wizard ----
  const startOnboarding = useCallback(async () => {
    if (!canStart) return;
    // Giriş yoksa VEYA anonim (misafir) bir oturumsa AI çağrısı harcamadan
    // önce auth modalını aç — AI özellikleri yalnızca kalıcı hesaplara açık.
    if (!user || user.is_anonymous) {
      onRequireAuth?.(AI_GATE_MESSAGE);
      return;
    }
    if (isLikelyGibberish(goal)) {
      setErrorMsg(`"${goalTrimmed}" ifadesinden anlamlı bir hedef çıkaramadık. Hedefini biraz daha açık yazar mısın?`);
      setStage(STAGE_ERROR);
      return;
    }
    setTemplateDaysOverride(null); // manuel akışta şablon geçersiz kılma uygulanmaz
    await beginOnboarding(category, goal);
  }, [canStart, user, onRequireAuth, goal, goalTrimmed, category, beginOnboarding]);

  // ---- Şablon Keşfet: "Şablonu Kullan" → hedef+kategori+gün sayısını aktarıp planı anında başlat ----
  const startFromTemplate = useCallback(
    async (template) => {
      if (!user || user.is_anonymous) {
        onRequireAuth?.(AI_GATE_MESSAGE);
        return;
      }
      // State güncellemeleri asenkron olduğundan (kapanış closure'ı state'i geç
      // görebilir) template değerlerini doğrudan kullanıyoruz; setGoal/setCategory
      // yalnızca UI'ın (wizard başlığı, geri dönülürse intro) tutarlı görünmesi için.
      setCategory(template.category);
      setGoal(template.goal);
      setTemplateDaysOverride(template.totalDays || null);
      await beginOnboarding(template.category, template.goal);
    },
    [user, onRequireAuth, beginOnboarding]
  );

  // ---- Wizard etkileşimleri ----
  const setAnswer = useCallback((value) => setAnswers((prev) => ({ ...prev, [wizardStep]: value })), [wizardStep]);
  const goNextQuestion = useCallback(() => setWizardStep((s) => Math.min(questions.length - 1, s + 1)), [questions.length]);
  const goPrevQuestion = useCallback(() => {
    if (wizardStep === 0) {
      setStage(STAGE_INTRO);
      return;
    }
    setWizardStep((s) => s - 1);
  }, [wizardStep]);

  // Wizard cevaplarını + hedefi AI'a bağlam olarak verip planı üretir/kaydeder.
  const finalizeAndGenerate = useCallback(async () => {
    if (!user || user.is_anonymous) {
      onRequireAuth?.(AI_GATE_MESSAGE);
      return;
    }
    setErrorMsg("");
    setStage(STAGE_LOADING);
    try {
      const answerContext = questions.map((q, i) => ({ question: q.title, answer: answers[i] || "(cevapsız)" }));
      if (extraNote.trim()) answerContext.push({ question: "Ek notlar / özel istekler", answer: extraNote.trim() });

      logger.info("PLAN_CREATE", "Plan oluşturma AI isteği gönderiliyor", { category, goalLength: goal.trim().length });
      const aiOutput = await createEnrichedPlan({ category, goal, answers: answerContext });
      // Şablon Keşfet'ten gelindiyse AI'ın total_days tahminini şablonun kesin
      // gün sayısıyla ez — kullanıcıya vaat edilen süre ile plan birebir eşleşsin.
      if (templateDaysOverride) aiOutput.total_days = templateDaysOverride;

      // Akıllı Widget Enjektörü (bkz. utils/smartWidgets.js) — kategori +
      // hedef metnindeki anahtar kelimelere göre 1. haftanın görevlerine
      // OTOMATİK varsayılan widget'lar ekler (savePlanToSupabase'e/flattenWeek'e
      // gitmeden ÖNCE, ham AI çıktısı üzerinde).
      const contextKey = detectSmartContext(category, goal);
      aiOutput.first_week_tasks = injectSmartWidgets(aiOutput.first_week_tasks, contextKey);

      const { plan, routines: routineRows, tasks } = await savePlanToSupabase(aiOutput, user.id, category);

      setDbPlan(plan);
      setRoutines(routineRows.length ? routineRows : (aiOutput.routines || []).map((c) => ({ content: String(c) })));
      setWeeks(groupTasksToWeeks(tasks));
      setStage(STAGE_PLAN);
      setTemplateDaysOverride(null);
      // Stratejik Başarı Kartı — deterministik analiz cümlesi + bu planda
      // enjekte edilen widget türlerinin rozet özeti (bkz. yukarıdaki
      // contextKey). PlanBoard zaten mount olur; bu modal onun ÜZERİNDE açılır.
      setPlanSummary({
        analysisText: buildStrategicAnalysis({ category, contextKey, totalDays: aiOutput.total_days, firstWeekTasks: (aiOutput.first_week_tasks || []).flatMap((d) => d.tasks || []) }),
        widgetBadges: getSmartWidgetBadges(contextKey),
      });
      setPlanSummaryOpen(true);
      refreshSavedPlans();
    } catch (err) {
      logger.error("PLAN_CREATE", "Plan oluşturulamadı", { category, error: err?.message });
      setErrorMsg(err?.message || "Plan oluşturulurken bir sorun oluştu. Lütfen tekrar dene.");
      setStage(STAGE_ERROR);
    }
  }, [user, onRequireAuth, questions, answers, extraNote, category, goal, templateDaysOverride, refreshSavedPlans]);

  // ---- "Kendi Planını Hazırla" — AI çağrısı OLMADAN, elle plan kaydı ----
  // Diğer plan-oluşturma yollarıyla (startOnboarding/startFromTemplate)
  // AYNI oturum kapısı: anonim/misafir oturumlar giriş yapmaya yönlendirilir
  // — bu bir AI maliyeti koruması DEĞİL (manuel akış zaten Gemini'ye hiç
  // gitmiyor), kalıcı bir hesaba BAĞLI plan saklama tutarlılığı içindir.
  // planId verilmezse: yeni plan modunda açılır (eskisiyle AYNI davranış).
  // planId verilirse: Plan Studio & Editor Engine "Planı Düzenle" — fetchPlanDetail
  // planId'ye ait TÜM görevleri/rutinleri (herhangi bir "yalnızca yüklü
  // haftalar" kısıtı OLMADAN) çeker, bu yüzden PlanBoard'da henüz lazy-load
  // edilmemiş sonraki haftalar bile düzenleme sırasında KAYBOLMAZ — çağıran
  // taraf (PlanBoard/MyPlansHub) kendi elindeki KISMİ `weeks`/`tasks`
  // state'ini DEĞİL, her zaman bir planId'yi geçer.
  const openManualBuilder = useCallback(
    async (planId) => {
      if (!user || user.is_anonymous) {
        onRequireAuth?.();
        return;
      }
      // `typeof planId === "string"` KASITLI bir savunma: bu fonksiyon bir
      // yerde bare `onClick={ps.openManualBuilder}` olarak (argümansız çağrı
      // sarmalayıcısı OLMADAN) bağlanırsa, React'in SyntheticEvent'i buraya
      // "planId" olarak sızar — bir event nesnesi HER ZAMAN truthy olduğu
      // için `!planId` kontrolü bunu YAKALAYAMAZ, sonuçta fetchPlanDetail
      // geçersiz bir değerle çağrılır ve builder sessizce hiç açılmadan
      // başarısız olur (bkz. CategoryIntro.jsx'teki canlıda yaşanmış örnek).
      // Gerçek bir planId HER ZAMAN string (uuid) olduğundan bu kontrol
      // yanlış-pozitif ÜRETMEZ.
      if (!planId || typeof planId !== "string") {
        setEditingPlanPayload(null);
        setManualBuilderOpen(true);
        return;
      }
      setEditLoading(true);
      try {
        const { plan, routines: routineRows, tasks } = await fetchPlanDetail(planId);
        setEditingPlanPayload({ plan, tasks, routines: routineRows });
        setManualBuilderOpen(true);
      } catch (err) {
        logger.error("PLAN_EDIT", "Düzenlenecek plan getirilemedi", { planId, error: err?.message });
      } finally {
        setEditLoading(false);
      }
    },
    [user, onRequireAuth]
  );

  const closeManualBuilder = useCallback(() => {
    setManualBuilderOpen(false);
    setEditingPlanPayload(null);
  }, []);

  // builder: ManualPlanBuilder.jsx'in yerel state'i (bkz. o dosyadaki JSDoc).
  // builder.editingPlanId doluysa (Plan Studio "Değişiklikleri Kaydet")
  // updateManualPlanInSupabase (sunucu, service_role — tasks satırlarını
  // TOPTAN değiştirebilmek için) çağrılır; boşsa (yeni plan) eskisi gibi
  // doğrudan Supabase insert. İkisi de AYNI {plan, routines, tasks} şeklini
  // döndürdüğü için sonrasındaki state güncellemesi TEK bir kod yolu.
  // Başarılı kayıttan sonra AYNI finalizeAndGenerate deseniyle doğrudan
  // STAGE_PLAN'a geçilir — kullanıcı "Kaydet"e bastığı anda planını GÖRÜR,
  // ayrıca "Planlarım"dan açması gerekmez.
  const saveManualPlan = useCallback(
    async (builder) => {
      if (!user || user.is_anonymous) {
        onRequireAuth?.();
        throw new Error("Devam etmek için giriş yapmalısın.");
      }
      const { plan, routines, tasks } = builder.editingPlanId
        ? await updateManualPlanInSupabase(builder.editingPlanId, builder, user.id)
        : await saveManualPlanToSupabase(builder, user.id);
      setDbPlan(plan);
      setRoutines(routines || []);
      setWeeks(groupTasksToWeeks(tasks));
      setCategory(plan.mode || "general");
      setStage(STAGE_PLAN);
      setManualBuilderOpen(false);
      setEditingPlanPayload(null);
      refreshSavedPlans();
    },
    [user, onRequireAuth, refreshSavedPlans]
  );

  // ---- LAZY LOAD: sonraki haftayı üret + kaydet + ekle ----
  // Devamlılık bağlamı (OPSİYONEL, geriye dönük uyumlu): `weekTopic`,
  // planın oluşturulduğu anda üretilen haftalık iskeletten (plans.week_topics
  // — bkz. supabase/plan_week_topics.sql) hedef haftanın taslak konusunu
  // çeker; `lastTaskTitle`, zaten client'ta elde olan `weeks` state'inden
  // (EK bir DB sorgusu GEREKMEZ) az önce biten haftanın SON görevinin
  // başlığını alır. İkisi de yoksa (eski bir plan, week_topics NULL) `undefined`
  // kalır — planPrompt.js bu durumda promptu HİÇ değiştirmez.
  const loadNextWeek = useCallback(async () => {
    if (!dbPlan || loadingNextWeek) return;
    const maxWeek = weeks.reduce((m, w) => Math.max(m, w.weekNumber), 0);
    const targetWeekNumber = maxWeek + 1;
    const weekTopic = dbPlan.week_topics?.[targetWeekNumber - 1] || undefined;
    const lastWeek = weeks.find((w) => w.weekNumber === maxWeek);
    const lastDay = lastWeek?.days?.[lastWeek.days.length - 1];
    const lastTaskTitle = lastDay?.tasks?.[lastDay.tasks.length - 1]?.title || undefined;
    setNextWeekError("");
    setLoadingNextWeek(true);
    try {
      const { week_tasks } = await fetchNextWeekTasks({
        planTitle: dbPlan.title,
        planSummary: dbPlan.summary,
        mode: dbPlan.mode,
        targetWeekNumber,
        weekTopic,
        lastTaskTitle,
      });
      // Akıllı Widget Enjektörü — 1. haftada kullanılan AYNI mantık (bkz.
      // finalizeAndGenerate). Orijinal hedef metni burada elde YOK (yalnızca
      // week_tasks üretiliyor) — dbPlan.title/summary makul bir vekil, AI
      // genelde bunları hedefin bir yansıması olarak üretiyor.
      const contextKey = detectSmartContext(dbPlan.mode, `${dbPlan.title || ""} ${dbPlan.summary || ""}`);
      const smartWeekTasks = injectSmartWidgets(week_tasks, contextKey);
      const rows = await saveWeekTasks(dbPlan.id, user.id, targetWeekNumber, smartWeekTasks);
      setWeeks((prev) => [...prev, ...groupTasksToWeeks(rows)]);
    } catch (err) {
      logger.error("PLAN_WEEK", "Sonraki hafta üretilemedi", { planId: dbPlan?.id, targetWeekNumber, error: err?.message });
      setNextWeekError(err?.message || "Sonraki hafta üretilirken bir sorun oluştu.");
    } finally {
      setLoadingNextWeek(false);
    }
  }, [dbPlan, loadingNextWeek, weeks, user]);

  // ---- Görev tamamlama (checkbox) — lokal + DB ----
  // Yalnızca dokunulan görevin ait olduğu hafta/gün nesnesi yeniden oluşturulur;
  // diğer hafta/gün/görev referansları AYNEN korunur. Bu sayede PlanBoard'daki
  // memoized TaskCard/DayCircle bileşenleri, değişmeyen kartlar için re-render'ı
  // (props referansı sabit kaldığından) atlayabilir — mobilde tik atma/kart
  // seçme anındaki FPS düşüşünün kök nedeni buradaki gereksiz tüm-ağaç kopyasıydı.
  // setWeeks çağrısı startTransition içine sarılı: bu, React'e "bu render'ı
  // gerekirse kesintiye uğrat/ertele, tıklamanın kendi tepkisini (buton :active
  // basılma animasyonu tarayıcı tarafından zaten anında ve JS'den bağımsız
  // veriliyor) bloklama" sinyali verir. Zaten O(1)'e yakın hafif bir güncelleme
  // olduğundan normal koşulda gecikme hissettirmez; zayıf donanımda arka arkaya
  // hızlı tıklamalarda ana thread'i tıkamaması için ek bir güvenlik payı sağlar.
  const toggleTask = useCallback((taskId, nextVal) => {
    startTransition(() => {
      setWeeks((prev) => patchTaskInWeeks(prev, taskId, { is_completed: nextVal }));
    });
    // DB yazması görsel olarak hiçbir şeye bağlı değil — parmak henüz ekrandan
    // kalkmamış/scroll sürüyor olabilir; bu yüzden tarayıcının boşta kaldığı ana
    // ertelenir (bkz. utils/idle.js, Safari için setTimeout düşüşlü).
    runWhenIdle(() => {
      setTaskCompletedSvc(taskId, nextVal).catch((err) => logger.error("TASK", "Görev durumu güncellenemedi", { taskId, error: err?.message }));
    });
  }, []);

  // ---- Görev widget'ları (Widget-Based Task System) — checkbox İLE AYNI
  // lokal-önce/DB-sonra desen, bkz. yukarıdaki toggleTask yorumu. ----
  const updateTaskWidgets = useCallback((taskId, nextWidgets) => {
    startTransition(() => {
      setWeeks((prev) => patchTaskInWeeks(prev, taskId, { widgets: nextWidgets }));
    });
    runWhenIdle(() => {
      setTaskWidgetsSvc(taskId, nextWidgets).catch((err) => logger.error("TASK", "Görev widget'ları güncellenemedi", { taskId, error: err?.message }));
    });
  }, []);

  // ---- Toplu Widget Atama (Day Batch Selector) — DayBatchWidgetModal.jsx'ten
  // çağrılır. `dayNumbers`: hedef gün numaraları (kilitsiz/erişilebilir
  // olduğu ÇAĞIRAN tarafından garanti edilir). `widgetTypes`: taskWidgets.js
  // kataloğundan seçilen tür anahtarları (ör. ["time","calorie"]).
  //
  // İKİ AYRI hedef kitle: (a) o gün ZATEN görevi olan günler — HER görevine
  // seçilen widget'ların TAZE birer kopyası (varsa MEVCUT widget'ların
  // YANINA, üzerine YAZMADAN) eklenir; (b) hiç görevi OLMAYAN günler — TEK,
  // minimal bir "taslak" görev oluşturulup widget'lar ONA eklenir (bkz.
  // planService.createDraftTask).
  //
  // STRICTMODE NOTU: hesaplama (hangi gün boş/dolu, hangi görev hangi
  // widget'ı alacak) setWeeks'İN İÇİNDEKİ bir updater fonksiyonu YERİNE
  // BURADA, dıştaki `weeks`'ten SAF olarak yapılır — updater fonksiyonları
  // React 18 StrictMode'da (geliştirmede) İKİ KEZ çağrılabilir; içeride DB
  // yazması TETİKLEYEN bir yan etki (affectedTaskUpdates.push) olsaydı bu
  // ÇİFT widget eklenmesine/çift DB yazmasına yol açardı.
  const batchApplyWidgets = useCallback(
    (dayNumbers, widgetTypes) => {
      if (!Array.isArray(dayNumbers) || dayNumbers.length === 0 || !Array.isArray(widgetTypes) || widgetTypes.length === 0) return;

      const affectedTaskUpdates = []; // {taskId, widgets}
      const emptyDayNumbers = [];
      let nextWeeks = weeks;

      for (const dayNum of dayNumbers) {
        let dayFound = null;
        for (const w of nextWeeks) {
          const day = w.days.find((d) => d.dayNumber === dayNum);
          if (day) {
            dayFound = day;
            break;
          }
        }
        if (!dayFound || dayFound.tasks.length === 0) {
          emptyDayNumbers.push(dayNum);
          continue;
        }
        for (const task of dayFound.tasks) {
          const freshWidgets = widgetTypes.map(createWidget).filter(Boolean);
          const nextTaskWidgets = [...(task.widgets || []), ...freshWidgets];
          affectedTaskUpdates.push({ taskId: task.id, widgets: nextTaskWidgets });
          nextWeeks = patchTaskInWeeks(nextWeeks, task.id, { widgets: nextTaskWidgets });
        }
      }

      if (nextWeeks !== weeks) {
        startTransition(() => setWeeks(nextWeeks));
      }

      if (affectedTaskUpdates.length > 0) {
        runWhenIdle(() => {
          for (const { taskId, widgets } of affectedTaskUpdates) {
            setTaskWidgetsSvc(taskId, widgets).catch((err) => logger.error("TASK", "Toplu widget kaydı başarısız", { taskId, error: err?.message }));
          }
        });
      }

      // Boş günler için taslak görev — GERÇEK bir insert (id gerektiği için
      // idle'a ERTELENEMEZ, ama kullanıcının akışını BLOKLAMAZ: buton
      // hemen tepki verir, taslaklar arka planda tek tek eklenir).
      if (emptyDayNumbers.length > 0 && dbPlan?.id && user?.id) {
        (async () => {
          for (const dayNum of emptyDayNumbers) {
            try {
              const widgets = widgetTypes.map(createWidget).filter(Boolean);
              const weekNumber = Math.max(1, Math.ceil(dayNum / 7));
              const row = await createDraftTaskSvc(dbPlan.id, user.id, weekNumber, dayNum, widgets);
              setWeeks((prev) => addTaskToWeeks(prev, weekNumber, dayNum, row));
            } catch (err) {
              logger.error("TASK", "Taslak görev oluşturulamadı", { dayNum, error: err?.message });
            }
          }
        })();
      }
    },
    [weeks, dbPlan, user]
  );

  // ---- Dinamik Gün/Tarih Bağlama — Tarih Kaydırma (Cascading Shift) ----
  // PlanBoard.jsx'teki N. günün tarih seçicisinden çağrılır: kullanıcı o günü
  // `selectedDateStr`e taşımak istediğinde, TÜM planın (1. günden itibaren)
  // aynı miktarda kaymasını sağlayan yeni start_date hesaplanır (bkz.
  // utils/planDate.shiftStartDateForDay) — toggleTask/updateTaskWidgets İLE
  // AYNI lokal-önce/DB-sonra desen: `dbPlan.start_date` ANINDA güncellenir
  // (usePlanDate.js'in dateForDay/currentDayNumber hesapları buna bağlı),
  // gerçek yazma tarayıcı boştayken ertelenir.
  const shiftPlanStartDate = useCallback(
    (dayNumber, selectedDateStr) => {
      if (!dbPlan?.id || !selectedDateStr) return;
      const newStartDate = shiftStartDateForDay(dayNumber, selectedDateStr);
      if (newStartDate === dbPlan.start_date) return;
      startTransition(() => {
        setDbPlan((prev) => (prev ? { ...prev, start_date: newStartDate } : prev));
      });
      runWhenIdle(() => {
        updatePlanStartDateSvc(dbPlan.id, newStartDate).catch((err) =>
          logger.error("PLAN_DATE", "Planın başlangıç tarihi güncellenemedi", { planId: dbPlan.id, error: err?.message })
        );
      });
    },
    [dbPlan]
  );

  // ---- Kayıtlı bir planı yeniden aç ----
  const openSavedPlan = useCallback(async (planId) => {
    setStage(STAGE_LOADING);
    try {
      const { plan, routines: routineRows, tasks } = await fetchPlanDetail(planId);
      setDbPlan(plan);
      setCategory(plan.mode || "general");
      setRoutines(routineRows);
      setWeeks(groupTasksToWeeks(tasks));
      setStage(STAGE_PLAN);
    } catch (err) {
      logger.error("PLAN_OPEN", "Plan açılamadı", { planId, error: err?.message });
      setErrorMsg(err?.message || "Plan açılırken bir sorun oluştu.");
      setStage(STAGE_ERROR);
    }
  }, []);

  // ---- Bir planı sil (menüdeki "Plan Sil" akışı) ----
  const deletePlan = useCallback(
    async (planId) => {
      try {
        await deletePlanSvc(planId);
        // Silinen plan o an açıksa aktif ekranı temizleyip intro'ya dön.
        if (dbPlan?.id === planId) {
          setDbPlan(null);
          setRoutines([]);
          setWeeks([]);
          setStage(STAGE_INTRO);
        }
        await refreshSavedPlans();
      } catch (err) {
        logger.error("PLAN_DELETE", "Plan silinemedi", { planId, error: err?.message });
      }
    },
    [dbPlan, refreshSavedPlans]
  );

  // Sunucudan (api/coach-action.js) dönen — zaten Supabase'e kalıcılaşmış —
  // task değişikliklerini local `weeks` state'ine optimistic olarak yansıtır.
  // Yalnızca ekranda AÇIK olan plan için çağrılır (başka bir plan mutasyona
  // uğradıysa board'u rahatsız etmeyiz — kullanıcı isterse "Görüntüle" ile geçer).
  // deletedTaskIds: AI Koç'un "kaldır/sil" dediği, sunucuda ZATEN silinmiş
  // görevlerin id'leri — burada yalnızca local `weeks` state'inden düşülürler
  // (DB'ye ikinci bir istek gerekmez, silme zaten api/coach-action.js'te oldu).
  // updatedPlan: "planı N güne indir/uzat" gibi isteklerde güncellenmiş
  // `plans` satırı (total_days dahil) — PlanBoard'un ızgara boyutu bundan
  // türediği için dbPlan'a da yansıtılır.
  const applyServerTaskChanges = useCallback((mutatedTasks = [], newTasks = [], deletedTaskIds = [], updatedPlan = null) => {
    if (mutatedTasks.length || newTasks.length || deletedTaskIds.length) {
      setWeeks((prev) => {
        const flat = prev.flatMap((w) => w.days.flatMap((d) => d.tasks));
        const byId = new Map(flat.map((t) => [t.id, t]));
        for (const id of deletedTaskIds) byId.delete(id);
        for (const mt of mutatedTasks) byId.set(mt.id, mt);
        for (const nt of newTasks) byId.set(nt.id, nt);
        return groupTasksToWeeks([...byId.values()]);
      });
    }
    if (updatedPlan) setDbPlan((prev) => (prev ? { ...prev, ...updatedPlan } : prev));
  }, []);

  // ---- AI Koç: hazır aksiyon çipleri (Planı Hafiflet / Tempoyu Sıkılaştır /
  // Bugün Çok Yoruldum / Gidişatımı Analiz Et) ----
  // Artık TAMAMEN sunucuda (api/coach-action.js, service_role): hak kontrolü/
  // düşümü ve gerçek Supabase mutasyonu orada olur. Client yalnızca sonucu
  // local state'e optimistic olarak uygular. Döner: { ok, consumed, message }.
  const applyCoachAction = useCallback(
    async (actionKey) => {
      if (!dbPlan) return { ok: false, consumed: false, message: "Önce bir plan açman gerekiyor." };

      const result = await callCoachAction({ action: actionKey, targetPlanId: dbPlan.id });
      if (result?.ok) {
        applyServerTaskChanges(result.mutatedTasks, result.newTasks, result.deletedTaskIds, result.updatedPlan);
        if (result.mutatedTasks?.length || result.newTasks?.length || result.deletedTaskIds?.length || result.updatedPlan) refreshSavedPlans();
      }
      return result;
    },
    [dbPlan, applyServerTaskChanges, refreshSavedPlans]
  );

  // ---- AI Koç: serbest metin (Multi-Plan Awareness) ----
  // Sunucu, AI'ın tespit ettiği hedef planı (ya da widget'ın dropdown'dan
  // seçilenini) kendi çözer ve mutasyonu orada yapar. Ekranda açık olan
  // plansa sonucu optimistic yansıtırız; başka bir plansa board'u değiştirmeyiz.
  // Döner: { ok, consumed, message, targetPlanId }.
  const sendCoachMessage = useCallback(
    async (message, { targetPlanId } = {}) => {
      const text = (message || "").trim();
      if (!text) return { ok: true, consumed: false, message: "" };
      if (!user) {
        onRequireAuth?.();
        return { ok: false, consumed: false, message: "Devam etmek için giriş yapmalısın." };
      }

      const result = await callCoachAction({ action: "freeText", message: text, targetPlanId: targetPlanId || dbPlan?.id });

      if (result?.ok && result.targetPlanId && result.targetPlanId === dbPlan?.id) {
        applyServerTaskChanges(result.mutatedTasks, result.newTasks, result.deletedTaskIds, result.updatedPlan);
        if (result.mutatedTasks?.length || result.newTasks?.length || result.deletedTaskIds?.length || result.updatedPlan) refreshSavedPlans();
      }

      return result;
    },
    [user, onRequireAuth, dbPlan, applyServerTaskChanges, refreshSavedPlans]
  );

  // Aktif planın ilerlemesi (tüm haftalar) — yalnızca `weeks` değiştiğinde
  // yeniden hesaplanır (ör. wizard/menü state'i değiştiğinde DEĞİL).
  const { totalTasks, completedTasks, overallPct } = useMemo(() => {
    const allTasks = weeks.flatMap((w) => w.days.flatMap((d) => d.tasks));
    const total = allTasks.length;
    const completed = allTasks.filter((t) => t.is_completed).length;
    return { totalTasks: total, completedTasks: completed, overallPct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [weeks]);

  const currentAnswer = answers[wizardStep];

  return {
    // durum
    category, mode, goal, extraNote, stage, errorMsg, menuOpen, savedPlans,
    remindersOn, hapticsOn,
    goalTrimmed, goalTooShort, canStart,
    manualBuilderOpen, editingPlanPayload, editLoading,
    // onboarding wizard
    questions, answers, wizardStep, currentAnswer,
    // aktif plan
    dbPlan, routines, weeks, loadingNextWeek, nextWeekError,
    totalTasks, completedTasks, overallPct,
    planSummary, planSummaryOpen, closePlanSummary,
    // setter/aksiyon
    setGoal, setExtraNote, setMenuOpen, setRemindersOn, setHapticsOn,
    handleCategoryChange, startOnboarding, setAnswer, goNextQuestion, goPrevQuestion, finalizeAndGenerate,
    loadNextWeek, toggleTask, updateTaskWidgets, batchApplyWidgets, shiftPlanStartDate, openSavedPlan, deletePlan, startNewPlan, resetToIntro, startFromTemplate,
    applyCoachAction, sendCoachMessage,
    openManualBuilder, closeManualBuilder, saveManualPlan,
  };
}
