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
  MAX_ACTIVE_PLANS,
} from "./constants";
import { generateOnboardingQuestions, createEnrichedPlan, fetchNextWeekTasks } from "./services/aiPipelineService";
import {
  savePlanToSupabase,
  saveWeekTasks,
  setTaskCompleted as setTaskCompletedSvc,
  fetchUserPlans,
  fetchPlanDetail,
  deletePlan as deletePlanSvc,
} from "./services/planService";
import { callCoachAction } from "./services/coachActionService";
import { setHapticsEnabled } from "./lib/haptics";
import logger from "./utils/logger";
import { runWhenIdle } from "./utils/idle";

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

  // "Planlarım" — oturum açıksa DB'den çekilen kayıtlı planların özeti.
  const [savedPlans, setSavedPlans] = useState([]);
  // 10 plan limitine takılan "+ Plan Ekle" denemesinde açılır (bkz.
  // startNewPlan) — app.jsx bunu ConfirmModal ile gösterir.
  const [planLimitOpen, setPlanLimitOpen] = useState(false);

  // Şablon Keşfet'ten "Şablonu Kullan" ile gelen kesin gün sayısı — AI'ın
  // total_days tahminini ezmek için finalizeAndGenerate'de kullanılır.
  const [templateDaysOverride, setTemplateDaysOverride] = useState(null);

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
    // Gerçek sınır sunucuda (bkz. supabase/plan_limit.sql trigger'ı, Nexus
    // şablon klonlamayı da kapsar) — bu, kullanıcının 11. planı denemeden
    // ÖNCE, wizard'a hiç girmeden şık bir modalla durdurulduğu UX katmanı.
    if (savedPlans.length >= MAX_ACTIVE_PLANS) {
      setPlanLimitOpen(true);
      return;
    }
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
    setStage(STAGE_INTRO);
  }, [savedPlans.length]);

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

      const { plan, routines: routineRows, tasks } = await savePlanToSupabase(aiOutput, user.id, category);

      setDbPlan(plan);
      setRoutines(routineRows.length ? routineRows : (aiOutput.routines || []).map((c) => ({ content: String(c) })));
      setWeeks(groupTasksToWeeks(tasks));
      setStage(STAGE_PLAN);
      setTemplateDaysOverride(null);
      refreshSavedPlans();
    } catch (err) {
      logger.error("PLAN_CREATE", "Plan oluşturulamadı", { category, error: err?.message });
      setErrorMsg(err?.message || "Plan oluşturulurken bir sorun oluştu. Lütfen tekrar dene.");
      setStage(STAGE_ERROR);
    }
  }, [user, onRequireAuth, questions, answers, extraNote, category, goal, templateDaysOverride, refreshSavedPlans]);

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
      const rows = await saveWeekTasks(dbPlan.id, user.id, targetWeekNumber, week_tasks);
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
      setWeeks((prev) => {
        for (const w of prev) {
          const dayIdx = w.days.findIndex((d) => d.tasks.some((t) => t.id === taskId));
          if (dayIdx === -1) continue;
          const day = w.days[dayIdx];
          const taskIdx = day.tasks.findIndex((t) => t.id === taskId);
          const nextTasks = day.tasks.slice();
          nextTasks[taskIdx] = { ...nextTasks[taskIdx], is_completed: nextVal };
          const nextDay = { ...day, tasks: nextTasks };
          const nextDays = w.days.slice();
          nextDays[dayIdx] = nextDay;
          const nextWeek = { ...w, days: nextDays };
          return prev.map((ww) => (ww === w ? nextWeek : ww));
        }
        return prev;
      });
    });
    // DB yazması görsel olarak hiçbir şeye bağlı değil — parmak henüz ekrandan
    // kalkmamış/scroll sürüyor olabilir; bu yüzden tarayıcının boşta kaldığı ana
    // ertelenir (bkz. utils/idle.js, Safari için setTimeout düşüşlü).
    runWhenIdle(() => {
      setTaskCompletedSvc(taskId, nextVal).catch((err) => logger.error("TASK", "Görev durumu güncellenemedi", { taskId, error: err?.message }));
    });
  }, []);

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
  const applyServerTaskChanges = useCallback((mutatedTasks = [], newTasks = []) => {
    if (!mutatedTasks.length && !newTasks.length) return;
    setWeeks((prev) => {
      const flat = prev.flatMap((w) => w.days.flatMap((d) => d.tasks));
      const byId = new Map(flat.map((t) => [t.id, t]));
      for (const mt of mutatedTasks) byId.set(mt.id, mt);
      for (const nt of newTasks) byId.set(nt.id, nt);
      return groupTasksToWeeks([...byId.values()]);
    });
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
        applyServerTaskChanges(result.mutatedTasks, result.newTasks);
        if (result.mutatedTasks?.length || result.newTasks?.length) refreshSavedPlans();
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
        applyServerTaskChanges(result.mutatedTasks, result.newTasks);
        if (result.mutatedTasks?.length || result.newTasks?.length) refreshSavedPlans();
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
    planLimitOpen, closePlanLimit: () => setPlanLimitOpen(false),
    remindersOn, hapticsOn,
    goalTrimmed, goalTooShort, canStart,
    // onboarding wizard
    questions, answers, wizardStep, currentAnswer,
    // aktif plan
    dbPlan, routines, weeks, loadingNextWeek, nextWeekError,
    totalTasks, completedTasks, overallPct,
    // setter/aksiyon
    setGoal, setExtraNote, setMenuOpen, setRemindersOn, setHapticsOn,
    handleCategoryChange, startOnboarding, setAnswer, goNextQuestion, goPrevQuestion, finalizeAndGenerate,
    loadNextWeek, toggleTask, openSavedPlan, deletePlan, startNewPlan, resetToIntro, startFromTemplate,
    applyCoachAction, sendCoachMessage,
  };
}
