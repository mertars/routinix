import { useState } from "react";
import { STAGE_INTRO, STAGE_WIZARD, STAGE_LOADING, STAGE_ERROR, STAGE_PLAN } from "./constants";
import usePlanStudio from "./usePlanStudio";
import useAuth from "./useAuth";
import Header from "./components/Header";
import AuthModal from "./components/AuthModal";
import ConfirmModal from "./components/ConfirmModal";
import DrawerMenu from "./components/DrawerMenu";
import CategoryIntro from "./components/CategoryIntro";
import OnboardingWizard from "./components/OnboardingWizard";
import PlanBoard from "./components/PlanBoard";
import GlobalStyles from "./components/GlobalStyles";

export default function App() {
  const auth = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const ps = usePlanStudio({ user: auth.user, onRequireAuth: () => setAuthOpen(true) });
  const { stage, mode } = ps;

  // Intro/loading/error ekranları CategoryIntro içinde, plan ekranı PlanBoard'da.
  const onIntroLike = stage === STAGE_INTRO || stage === STAGE_LOADING || stage === STAGE_ERROR;

  return (
    <div className="min-h-screen w-full flex justify-center" style={{ background: "#0A0E13" }}>
      <div className="w-full max-w-[430px] min-h-screen flex flex-col relative text-[#ECF2F4]">
        <Header
          modeAccent={mode.accent}
          modeAccentSoft={mode.accentSoft}
          user={auth.user}
          onAuthClick={() => setAuthOpen(true)}
          onSignOut={() => setLogoutConfirmOpen(true)}
          onMenuToggle={() => ps.setMenuOpen((v) => !v)}
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
          focusSoundsOn={ps.focusSoundsOn}
          onToggleFocusSounds={() => ps.setFocusSoundsOn((v) => !v)}
          onNewPlan={ps.startNewPlan}
          onSignOut={() => {
            ps.setMenuOpen(false);
            setLogoutConfirmOpen(true);
          }}
        />

        <main className="flex-1 px-5 pt-6 pb-16">
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
              onBack={ps.resetToIntro}
            />
          )}
        </main>
      </div>

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

      <GlobalStyles />
    </div>
  );
}
