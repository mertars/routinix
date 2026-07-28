import { useState, useEffect, useCallback } from "react";
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
import { setHapticsEnabled } from "./lib/haptics";
import logger from "./utils/logger";

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

  const handleCategoryChange = (key) => setCategory(key);

  const resetToIntro = () => {
    setStage(STAGE_INTRO);
    refreshSavedPlans();
  };

  const startNewPlan = () => {
    setGoal("");
    setExtraNote("");
    setErrorMsg("");
    setDbPlan(null);
    setRoutines([]);
    setWeeks([]);
    setQuestions([]);
    setAnswers({});
    setWizardStep(0);
    setMenuOpen(false);
    setTemplateDaysOverride(null);
    setStage(STAGE_INTRO);
  };

  // Ortak: verilen kategori/hedef için dinamik onboarding sorularını üretip
  // wizard'a geçer. startOnboarding (manuel "Başla") ve startFromTemplate
  // (Şablon Keşfet) bunu paylaşır.
  const beginOnboarding = async (cat, goalText) => {
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
  };

  // ---- ADIM 1: Intro "Devam Et" → auth gate → dinamik soruları üret → wizard ----
  const startOnboarding = async () => {
    if (!canStart) return;
    // Giriş yoksa AI çağrısı harcamadan önce auth modalını aç.
    if (!user) {
      onRequireAuth?.();
      return;
    }
    if (isLikelyGibberish(goal)) {
      setErrorMsg(`"${goalTrimmed}" ifadesinden anlamlı bir hedef çıkaramadık. Hedefini biraz daha açık yazar mısın?`);
      setStage(STAGE_ERROR);
      return;
    }
    setTemplateDaysOverride(null); // manuel akışta şablon geçersiz kılma uygulanmaz
    await beginOnboarding(category, goal);
  };

  // ---- Şablon Keşfet: "Şablonu Kullan" → hedef+kategori+gün sayısını aktarıp planı anında başlat ----
  const startFromTemplate = async (template) => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    // State güncellemeleri asenkron olduğundan (kapanış closure'ı state'i geç
    // görebilir) template değerlerini doğrudan kullanıyoruz; setGoal/setCategory
    // yalnızca UI'ın (wizard başlığı, geri dönülürse intro) tutarlı görünmesi için.
    setCategory(template.category);
    setGoal(template.goal);
    setTemplateDaysOverride(template.totalDays || null);
    await beginOnboarding(template.category, template.goal);
  };

  // ---- Wizard etkileşimleri ----
  const setAnswer = (value) => setAnswers((prev) => ({ ...prev, [wizardStep]: value }));
  const goNextQuestion = () => setWizardStep((s) => Math.min(questions.length - 1, s + 1));
  const goPrevQuestion = () => {
    if (wizardStep === 0) {
      setStage(STAGE_INTRO);
      return;
    }
    setWizardStep((s) => s - 1);
  };

  // Wizard cevaplarını + hedefi AI'a bağlam olarak verip planı üretir/kaydeder.
  const finalizeAndGenerate = async () => {
    if (!user) {
      onRequireAuth?.();
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
  };

  // ---- LAZY LOAD: sonraki haftayı üret + kaydet + ekle ----
  const loadNextWeek = async () => {
    if (!dbPlan || loadingNextWeek) return;
    const maxWeek = weeks.reduce((m, w) => Math.max(m, w.weekNumber), 0);
    const targetWeekNumber = maxWeek + 1;
    setNextWeekError("");
    setLoadingNextWeek(true);
    try {
      const { week_tasks } = await fetchNextWeekTasks({
        planTitle: dbPlan.title,
        planSummary: dbPlan.summary,
        mode: dbPlan.mode,
        targetWeekNumber,
      });
      const rows = await saveWeekTasks(dbPlan.id, user.id, targetWeekNumber, week_tasks);
      setWeeks((prev) => [...prev, ...groupTasksToWeeks(rows)]);
    } catch (err) {
      logger.error("PLAN_WEEK", "Sonraki hafta üretilemedi", { planId: dbPlan?.id, targetWeekNumber, error: err?.message });
      setNextWeekError(err?.message || "Sonraki hafta üretilirken bir sorun oluştu.");
    } finally {
      setLoadingNextWeek(false);
    }
  };

  // ---- Görev tamamlama (checkbox) — lokal + DB ----
  const toggleTask = (taskId, nextVal) => {
    setWeeks((prev) =>
      prev.map((w) => ({
        ...w,
        days: w.days.map((d) => ({
          ...d,
          tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, is_completed: nextVal } : t)),
        })),
      }))
    );
    setTaskCompletedSvc(taskId, nextVal).catch((err) => logger.error("TASK", "Görev durumu güncellenemedi", { taskId, error: err?.message }));
  };

  // ---- Kayıtlı bir planı yeniden aç ----
  const openSavedPlan = async (planId) => {
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
  };

  // ---- Bir planı sil (menüdeki "Plan Sil" akışı) ----
  const deletePlan = async (planId) => {
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
  };

  // Aktif planın ilerlemesi (tüm haftalar).
  const allTasks = weeks.flatMap((w) => w.days.flatMap((d) => d.tasks));
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.is_completed).length;
  const overallPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const currentAnswer = answers[wizardStep];

  return {
    // durum
    category, mode, goal, extraNote, stage, errorMsg, menuOpen, savedPlans,
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
  };
}
