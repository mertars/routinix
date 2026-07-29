import { useState, useEffect } from "react";
import { Timer } from "lucide-react";
import { STAGE_INTRO, STAGE_WIZARD, STAGE_LOADING, STAGE_ERROR, STAGE_PLAN } from "./constants";
import usePlanStudio from "./usePlanStudio";
import useAuth from "./useAuth";
import { tapFeedback } from "./lib/haptics";
import { setLogUser } from "./utils/logger";
import Header from "./components/Header";
import AuthModal from "./components/AuthModal";
import ConfirmModal from "./components/ConfirmModal";
import DrawerMenu from "./components/DrawerMenu";
import DeletePlanModal from "./components/DeletePlanModal";
import TodayPopover from "./components/TodayPopover";
import RoutinesPopover from "./components/RoutinesPopover";
import PrintModal from "./components/PrintModal";
import PrintablePlan from "./components/PrintablePlan";
import TemplateHub from "./components/TemplateHub";
import MyPlansHub from "./components/MyPlansHub";
import AiCoachWidget from "./components/AiCoachWidget";
import PomodoroStudio from "./components/PomodoroStudio";
import CategoryIntro from "./components/CategoryIntro";
import OnboardingWizard from "./components/OnboardingWizard";
import PlanBoard from "./components/PlanBoard";
import BackgroundScene from "./components/BackgroundScene";
import GlobalStyles from "./components/GlobalStyles";

export default function App() {
  const auth = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [pomodoroInitialTaskId, setPomodoroInitialTaskId] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [printRange, setPrintRange] = useState(Infinity);
  const ps = usePlanStudio({ user: auth.user, onRequireAuth: () => setAuthOpen(true) });
  const { stage, mode } = ps;

  // Bugün / Rutinler / Şablon Keşfet / Planlarım / Pomodoro panellerinden aynı
  // anda yalnızca biri açık olur; tetiklendiklerinde hamburger menüsü de kapanır
  // (mobilde Hızlı Erişim'den açılan paneller için gerekli, masaüstünde zararsız).
  const closeAllPanels = () => {
    setTodayOpen(false);
    setRoutinesOpen(false);
    setHubOpen(false);
    setPlansOpen(false);
    setPomodoroOpen(false);
  };
  const toggleToday = () => {
    const next = !todayOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setTodayOpen(next);
  };
  const toggleRoutines = () => {
    const next = !routinesOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setRoutinesOpen(next);
  };
  const toggleHub = () => {
    const next = !hubOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setHubOpen(next);
  };
  const togglePlans = () => {
    const next = !plansOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setPlansOpen(next);
  };
  const togglePomodoro = () => {
    const next = !pomodoroOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setPomodoroOpen(next);
  };
  // Görev kartındaki "Başlat" — Pomodoro Studio'yu bu görev seçiliyken açar
  // (bkz. PomodoroStudio.jsx `initialTaskId` prop'u).
  const startPomodoroForTask = (taskId) => {
    setPomodoroInitialTaskId(taskId);
    closeAllPanels();
    ps.setMenuOpen(false);
    setPomodoroOpen(true);
  };

  // Dokunsal geri bildirim: herhangi bir butona basıldığında hafif mikro titreşim
  // (haptics açıksa). Prop-drilling yerine tek bir global dinleyici.
  useEffect(() => {
    const onClick = (e) => {
      if (e.target.closest("button")) tapFeedback();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Kalıcılaşan (Supabase) loglara hangi kullanıcının oturumunda oluştuğunu
  // eklemek için logger'ın modül seviyesindeki kullanıcı bağlamını senkronla.
  useEffect(() => {
    setLogUser(auth.user?.id ?? null);
  }, [auth.user]);

  // Intro/loading/error ekranları CategoryIntro içinde, plan ekranı PlanBoard'da.
  const onIntroLike = stage === STAGE_INTRO || stage === STAGE_LOADING || stage === STAGE_ERROR;

  return (
    <div className="w-full" style={{ background: "var(--bg-app)" }}>
      {/* Atmosferik animasyonlu dağ/topoğrafya + neon şerit arka planı (içeriğin
          arkasında) — ambient glow rengi aktif kategoriye göre (intro'da seçili
          sekme, plan içindeyken planın kendi kategorisi) yumuşakça değişir. */}
      <BackgroundScene category={ps.category} />

      {/* Mobilde intro tek ekrana kilitli (h-100dvh, scroll yok); md'den itibaren serbest. */}
      <div
        className={`relative z-10 flex flex-col text-[var(--text-primary)] ${
          onIntroLike
            ? "h-[100dvh] overflow-hidden md:h-auto md:min-h-screen md:overflow-visible"
            : "min-h-[100dvh]"
        }`}
      >
        <Header
          modeAccent={mode.accent}
          modeAccentSoft={mode.accentSoft}
          user={auth.user}
          todayActive={todayOpen}
          onTodayClick={toggleToday}
          routinesActive={routinesOpen}
          onRoutinesClick={toggleRoutines}
          hubActive={hubOpen}
          onHubClick={toggleHub}
          plansActive={plansOpen}
          onPlansClick={togglePlans}
          pomodoroActive={pomodoroOpen}
          onPomodoroClick={togglePomodoro}
          onAuthClick={() => setAuthOpen(true)}
          onSignOut={() => setLogoutConfirmOpen(true)}
          onMenuToggle={() => ps.setMenuOpen((v) => !v)}
          onLogoClick={() => {
            closeAllPanels();
            ps.setMenuOpen(false);
            ps.resetToIntro();
          }}
        />

        <DrawerMenu
          open={ps.menuOpen}
          onClose={() => ps.setMenuOpen(false)}
          accent={mode.accent}
          accentSoft={mode.accentSoft}
          user={auth.user}
          savedPlansCount={ps.savedPlans.length}
          remindersOn={ps.remindersOn}
          onToggleReminders={() => ps.setRemindersOn((v) => !v)}
          hapticsOn={ps.hapticsOn}
          onToggleHaptics={() => ps.setHapticsOn((v) => !v)}
          onNewPlan={ps.startNewPlan}
          onDeletePlan={() => {
            ps.setMenuOpen(false);
            setDeleteOpen(true);
          }}
          onOpenHub={toggleHub}
          onOpenToday={toggleToday}
          onOpenRoutines={toggleRoutines}
          onOpenPlans={togglePlans}
          onOpenPomodoro={togglePomodoro}
          onSignOut={() => {
            ps.setMenuOpen(false);
            setLogoutConfirmOpen(true);
          }}
        />

        <main
          className={`flex-1 min-h-0 w-full mx-auto ${
            onIntroLike
              ? "max-w-7xl px-4 md:px-6 pt-4 md:pt-8 pb-4 md:pb-10 flex flex-col"
              : stage === STAGE_PLAN
                ? "max-w-7xl px-4 md:px-8 pt-6 pb-16"
                : "max-w-xl px-5 pt-6 pb-16"
          }`}
        >
          {onIntroLike && (
            <CategoryIntro
              stage={stage}
              category={ps.category}
              goal={ps.goal}
              goalTooShort={ps.goalTooShort}
              canStart={ps.canStart}
              savedPlans={ps.savedPlans}
              onCategoryChange={ps.handleCategoryChange}
              onGoalChange={ps.setGoal}
              onStart={ps.startOnboarding}
              onOpenSavedPlan={ps.openSavedPlan}
              errorMsg={ps.errorMsg}
              onBackToIntro={ps.resetToIntro}
            />
          )}

          {stage === STAGE_WIZARD && (
            <OnboardingWizard
              accent={mode.accent}
              accentSoft={mode.accentSoft}
              questions={ps.questions}
              wizardStep={ps.wizardStep}
              currentAnswer={ps.currentAnswer}
              onSetAnswer={ps.setAnswer}
              onPrev={ps.goPrevQuestion}
              onNext={ps.goNextQuestion}
              onFinish={ps.finalizeAndGenerate}
            />
          )}

          {stage === STAGE_PLAN && (
            <PlanBoard
              plan={ps.dbPlan}
              routines={ps.routines}
              weeks={ps.weeks}
              overallPct={ps.overallPct}
              completedTasks={ps.completedTasks}
              totalTasks={ps.totalTasks}
              loadingNextWeek={ps.loadingNextWeek}
              nextWeekError={ps.nextWeekError}
              onToggleTask={ps.toggleTask}
              onLoadNextWeek={ps.loadNextWeek}
              onStartPomodoro={startPomodoroForTask}
              onPrint={() => setPrintOpen(true)}
              onBack={ps.resetToIntro}
            />
          )}
        </main>
      </div>

      {/* Bugünün Görevleri + Rutinler popover'ları (aynı anda yalnızca biri açık) */}
      <TodayPopover open={todayOpen} userId={auth.user?.id} onClose={() => setTodayOpen(false)} />
      <RoutinesPopover open={routinesOpen} userId={auth.user?.id} onClose={() => setRoutinesOpen(false)} />

      <AuthModal
        open={authOpen}
        accent={mode.accent}
        onClose={() => setAuthOpen(false)}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        onGoogle={auth.signInWithGoogle}
        onSuccess={() => setAuthOpen(false)}
      />

      <ConfirmModal
        open={logoutConfirmOpen}
        danger
        title="Çıkış yapmak istediğinizden emin misiniz?"
        message="Hesabından çıkış yapılacak. Kaydedilmiş planların hesabında güvende kalır."
        confirmLabel="Evet, Çıkış Yap"
        cancelLabel="Vazgeç"
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          auth.signOut();
          ps.startNewPlan();
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      <DeletePlanModal
        open={deleteOpen}
        plans={ps.savedPlans}
        onDelete={ps.deletePlan}
        onClose={() => setDeleteOpen(false)}
      />

      {/* Şablon Keşfet — hazır rota kütüphanesi */}
      <TemplateHub open={hubOpen} onClose={() => setHubOpen(false)} onUseTemplate={ps.startFromTemplate} />

      {/* Planlarım — tüm kayıtlı planlar, ilerlemeleriyle */}
      <MyPlansHub
        open={plansOpen}
        userId={auth.user?.id}
        onOpenPlan={ps.openSavedPlan}
        onClose={() => setPlansOpen(false)}
      />

      {/* Pomodoro & Focus Studio — herkese açık (Şablon Keşfet gibi) */}
      <PomodoroStudio open={pomodoroOpen} userId={auth.user?.id} initialTaskId={pomodoroInitialTaskId} onClose={() => setPomodoroOpen(false)} />

      {/* AI Koç — yalnızca PlanBoard ekranındayken (yalnızca `dbPlan` kontrolü
          yetersizdi: "‹ Ana Sayfa" ile intro'ya dönünce dbPlan temizlenmediği
          için widget CategoryIntro/OnboardingWizard'ın alt sticky "Başla" /
          "Planı Oluştur" butonunun üzerine biniyordu). */}
      {stage === STAGE_PLAN && ps.dbPlan && (
        <AiCoachWidget
          plan={ps.dbPlan}
          userId={auth.user?.id}
          onApplyAction={ps.applyCoachAction}
          onSendMessage={ps.sendCoachMessage}
          onJumpToPlan={ps.openSavedPlan}
        />
      )}

      {/* Pomodoro'nun mobil "alt menü" erişim noktası — AiCoachWidget ile aynı
          çakışma riskini taşımaması için yalnızca PlanBoard'dayken (sticky CTA'sız
          ekran) ve sol altta (sağ alt AiCoachWidget'a ait) gösterilir. */}
      {stage === STAGE_PLAN && (
        <button
          onClick={togglePomodoro}
          aria-label="Pomodoro & Focus Studio"
          className="md:hidden fixed z-40 flex items-center justify-center w-14 h-14 rounded-full transition-transform hover:scale-105 active:scale-95"
          style={{
            left: "1.5rem",
            bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
            background: "linear-gradient(135deg, #FB7185, #F43F5E)",
            boxShadow: "0 10px 34px -10px rgba(251,113,133,0.75)",
          }}
        >
          <Timer className="w-6 h-6 text-white" strokeWidth={2.25} />
        </button>
      )}

      {/* PDF / Yazdır — aralık seçimi + yazdır */}
      <PrintModal
        open={printOpen}
        accent={mode.accent}
        maxDays={ps.weeks.reduce((n, w) => n + (w.days?.length || 0), 0)}
        onExport={(days) => {
          setPrintRange(days);
          setPrintOpen(false);
          // DOM güncellensin, sonra yazdır.
          setTimeout(() => window.print(), 60);
        }}
        onClose={() => setPrintOpen(false)}
      />

      {/* Baskı şablonu — ekranda gizli, yalnızca yazdırmada görünür */}
      <PrintablePlan plan={ps.dbPlan} routines={ps.routines} weeks={ps.weeks} days={printRange} />

      <GlobalStyles />
    </div>
  );
}
