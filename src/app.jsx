import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { STAGE_INTRO, STAGE_WIZARD, STAGE_LOADING, STAGE_ERROR, STAGE_PLAN } from "./constants";
import usePlanStudio from "./usePlanStudio";
import useAuth from "./useAuth";
import { tapFeedback } from "./lib/haptics";
import { setLogUser } from "./utils/logger";
import Header from "./components/Header";
import ConfirmModal from "./components/ConfirmModal";
import DrawerMenu from "./components/DrawerMenu";
import DeletePlanModal from "./components/DeletePlanModal";
import CategoryIntro from "./components/CategoryIntro";
import PlanBoard from "./components/PlanBoard";
import ScopedErrorBoundary from "./components/ScopedErrorBoundary";
import BackgroundScene from "./components/BackgroundScene";
import GlobalStyles from "./components/GlobalStyles";
// Nexus link paylaşımı ("/t/:templateId") — anonim ziyaretçiler için ilk
// boyamada gerekebilir (yavaş bir "lazy" gecikmesi PLG akışında istenmez),
// bu yüzden diğer panellerin aksine BİLEREK statik import edilir.
import SharedTemplateView from "./components/SharedTemplateView";
import GuestBanner from "./components/GuestBanner";
import { InlineFallback, FabFallback, OverlayFallback } from "./components/LazyFallback";

// İlk boyamada (intro ekranı) KESİNLİKLE gerekmeyen, yalnızca kullanıcı
// etkileşimiyle açılan panel/modal bileşenleri — ayrı chunk'lara bölünür
// (React.lazy) ki ana bundle'ın parse/derleme yükü küçülsün.
//
// GÖRÜNÜM İZOLASYONU (View Isolation): TaskDrawer/RoutinesPopover/AuthModal/
// TemplateHub/MyPlansHub/RhythmStudio artık KOŞULLU mount ediliyor
// (`{open && <Suspense>...}`, aşağıda) — panel kapanır kapanmaz TÜMÜYLE
// unmount olur: içindeki her useEffect/interval/event listener React'in
// temizleme (cleanup) mekanizmasıyla anında söker, hiçbir arka plan state
// güncellemesi/CPU çalışması kalmaz. Kullanıcı o an ekranda GÖRÜNEN tek bir
// panel dışında hiçbir şey render edilmiyor. Bunun bilinen, kabul edilmiş
// bedeli: bu panellerin kendi iç state'i (ör. TaskDrawer'ın arama kutusu,
// TemplateHub'ın seçili sekmesi) her kapanışta sıfırlanır — düşük riskli/
// beklenen bir UX (arama kutusunun sıfırlanması, ör. AuthModal'ın formu
// sıfırlaması gibi çoğu zaman zaten İSTENEN bir davranış).
//
// PomodoroStudio + PrintModal/PrintablePlan İSTİSNA — bkz. aşağıdaki
// render bloklarındaki yorumlar: Pomodoro'nun sayacı kapalıyken de GERÇEK
// ZAMANDA saymaya devam etmesi gerektiği için (bkz. PomodoroStudio.jsx),
// PrintablePlan ise `window.print()` tetiklendiği anda DOM'da olması
// gerektiği için hâlâ UNCONDITIONAL mount + `fallback={null}` kullanır.
const AuthModal = lazy(() => import("./components/AuthModal"));
const TaskDrawer = lazy(() => import("./components/TaskDrawer"));
const RoutinesPopover = lazy(() => import("./components/RoutinesPopover"));
const PrintModal = lazy(() => import("./components/PrintModal"));
const PrintablePlan = lazy(() => import("./components/PrintablePlan"));
const TemplateHub = lazy(() => import("./components/TemplateHub"));
const MyPlansHub = lazy(() => import("./components/MyPlansHub"));
const AiCoachWidget = lazy(() => import("./components/AiCoachWidget"));
const PomodoroStudio = lazy(() => import("./components/PomodoroStudio"));
const OnboardingWizard = lazy(() => import("./components/OnboardingWizard"));
const RhythmStudio = lazy(() => import("./components/RhythmStudio"));
const CommunityHub = lazy(() => import("./components/CommunityHub"));
const NexusProfileOverlay = lazy(() => import("./components/community/NexusProfileOverlay"));

export default function App() {
  const auth = useAuth();
  // Nexus link paylaşımı ("/t/:templateId") — mount anında TEK SEFERLİK
  // okunur (sonraki navigasyonlar zaten `handleSharedTemplateDone` ile
  // `window.history.replaceState` üzerinden "/"e döner, bu state'i tekrar
  // hesaplamaya gerek yok).
  const [sharedTemplateId, setSharedTemplateId] = useState(() => {
    if (typeof window === "undefined") return null;
    const m = window.location.pathname.match(/^\/t\/([^/?#]+)/);
    return m ? m[1] : null;
  });
  const [authOpen, setAuthOpen] = useState(false);
  // AuthModal'ın "neden açıldığını" anlatan opsiyonel bağlam mesajı (ör. AI
  // Koç/AI Plan Oluşturucu kilidine takılınca) — bkz. requireAuth aşağıda.
  const [authContext, setAuthContext] = useState(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [pomodoroInitialTask, setPomodoroInitialTask] = useState(null);
  const [rhythmOpen, setRhythmOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [nexusProfileOpen, setNexusProfileOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printRange, setPrintRange] = useState(Infinity);
  // Tek, paylaşılan "auth iste" tetikleyicisi — hem düz "Giriş Yap" tıklamaları
  // (mesajsız, `requireAuth()`) hem de AI kilidi (mesajlı, `requireAuth(AI_GATE_MESSAGE)`)
  // BUNU kullanır; usePlanStudio'nun `onRequireAuth` prop'una GEÇİLEBİLMESİ için
  // hook çağrısından ÖNCE tanımlanmış olması gerekir.
  const requireAuth = useCallback((message) => {
    setAuthContext(message || null);
    setAuthOpen(true);
  }, []);

  const ps = usePlanStudio({ user: auth.user, onRequireAuth: requireAuth });
  const { stage, mode } = ps;

  // Mesajsız/düz "Giriş Yap" için STABİL bir referans — Header memo() olduğu
  // için burada her render'da YENİ bir inline ok fonksiyonu vermek memo'yu
  // etkisiz kılardı (bkz. dosya başı "View Isolation" yorumu).
  const openAuth = useCallback(() => requireAuth(), [requireAuth]);

  // SharedTemplateView'da "Aktif Rutinlerime Ekle" başarıyla tamamlanınca:
  // URL'i temizle ("/"), özel görünümden çık (normal uygulama kabuğu
  // render olsun) ve yeni oluşan planı doğrudan aç.
  const handleSharedTemplateDone = useCallback(
    (plan) => {
      window.history.replaceState({}, "", "/");
      setSharedTemplateId(null);
      if (plan?.id) ps.openSavedPlan(plan.id);
    },
    [ps.openSavedPlan]
  );

  // BackgroundScene KÖKTE sabit mount edilir ve hiçbir panel açılınca
  // unmount OLMAZ — panel onu yalnızca görsel olarak ÖRTER, kendisi
  // (feGaussianBlur'lu SVG dash animasyonu + blur(70px)'lu blob'lar)
  // arkada sonsuza dek animasyona devam eder. Bu bayrak, üstte tam ekran
  // bir panel/modal açıkken BackgroundScene'e "dur" sinyali verir — aksi
  // halde kullanıcı hiç GÖRMEDİĞİ bu animasyon GPU'yu meşgul etmeyi sürdürür
  // (ısınmanın asıl kaynağı genelde panelin kendi CSS'i değil, budur).
  const anyOverlayOpen =
    authOpen || logoutConfirmOpen || deleteOpen || taskDrawerOpen || routinesOpen || hubOpen || plansOpen || pomodoroOpen || rhythmOpen || communityOpen || printOpen;

  // Bugün / Rutinler / Şablon Keşfet / Planlarım / Pomodoro panellerinden aynı
  // anda yalnızca biri açık olur; tetiklendiklerinde hamburger menüsü de kapanır
  // (mobilde Hızlı Erişim'den açılan paneller için gerekli, masaüstünde zararsız).
  // Tüm bu handler'lar useCallback ile sarılı — Header/DrawerMenu artık memo
  // olduğundan (bkz. Header.jsx/DrawerMenu.jsx), referansları stabil kalmazsa
  // memo hiçbir şeyi atlayamaz; asıl amaç "goal" gibi sık değişen state'lerin
  // Header/DrawerMenu'yü gereksiz yere yeniden render etmesini engellemek.
  const closeAllPanels = useCallback(() => {
    setTaskDrawerOpen(false);
    setRoutinesOpen(false);
    setHubOpen(false);
    setPlansOpen(false);
    setPomodoroOpen(false);
    setRhythmOpen(false);
    setCommunityOpen(false);
  }, []);
  const toggleTaskDrawer = useCallback(() => {
    const next = !taskDrawerOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setTaskDrawerOpen(next);
  }, [taskDrawerOpen, closeAllPanels, ps.setMenuOpen]);
  const toggleRoutines = useCallback(() => {
    const next = !routinesOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setRoutinesOpen(next);
  }, [routinesOpen, closeAllPanels, ps.setMenuOpen]);
  const toggleHub = useCallback(() => {
    const next = !hubOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setHubOpen(next);
  }, [hubOpen, closeAllPanels, ps.setMenuOpen]);
  const togglePlans = useCallback(() => {
    const next = !plansOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setPlansOpen(next);
  }, [plansOpen, closeAllPanels, ps.setMenuOpen]);
  const togglePomodoro = useCallback(() => {
    const next = !pomodoroOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setPomodoroOpen(next);
  }, [pomodoroOpen, closeAllPanels, ps.setMenuOpen]);
  const toggleRhythm = useCallback(() => {
    const next = !rhythmOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setRhythmOpen(next);
  }, [rhythmOpen, closeAllPanels, ps.setMenuOpen]);
  const toggleCommunity = useCallback(() => {
    const next = !communityOpen;
    closeAllPanels();
    ps.setMenuOpen(false);
    setCommunityOpen(next);
  }, [communityOpen, closeAllPanels, ps.setMenuOpen]);
  // DrawerMenu'deki "Profil & İstatistikler" kartı — ağır CommunityHub'ı
  // (tüm şablon feed'i + arama) MONTE ETMEDEN, doğrudan hafif bir tam ekran
  // profil görünümü açar (bkz. NexusProfileOverlay.jsx).
  const openNexusProfile = useCallback(() => {
    closeAllPanels();
    ps.setMenuOpen(false);
    setNexusProfileOpen(true);
  }, [closeAllPanels, ps.setMenuOpen]);
  // Görev kartındaki "Başlat" — Pomodoro Studio'yu bu görev seçiliyken açar
  // (bkz. PomodoroStudio.jsx `initialTask` prop'u). Tam görev objesi TaskCard'dan
  // geldiği için PomodoroStudio kendi başına ayrı bir plan/görev fetch'i
  // yapmak zorunda kalmıyor — tek doğruluk kaynağı çağıran yerdeki veridir.
  const startPomodoroForTask = useCallback(
    (task) => {
      setPomodoroInitialTask(task);
      closeAllPanels();
      ps.setMenuOpen(false);
      setPomodoroOpen(true);
    },
    [closeAllPanels, ps.setMenuOpen]
  );

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

  // Header/DrawerMenu'ye geçen geri kalan tekil handler'lar — memo'nun etkili
  // olması için bunlar da stabil referanslı olmalı (bkz. yukarıdaki toggle*).
  const requestSignOut = useCallback(() => setLogoutConfirmOpen(true), []);
  const toggleHamburger = useCallback(() => ps.setMenuOpen((v) => !v), [ps.setMenuOpen]);
  const closeHamburger = useCallback(() => ps.setMenuOpen(false), [ps.setMenuOpen]);
  const onLogoClick = useCallback(() => {
    closeAllPanels();
    ps.setMenuOpen(false);
    ps.resetToIntro();
  }, [closeAllPanels, ps.setMenuOpen, ps.resetToIntro]);
  const onDeletePlan = useCallback(() => {
    ps.setMenuOpen(false);
    setDeleteOpen(true);
  }, [ps.setMenuOpen]);

  // Giriş/Kayıt modalı JSX'i TEK yerde tanımlanır — hem normal uygulama
  // kabuğunda hem de SharedTemplateView'ın erken-return dalında (aşağıda)
  // kullanılır, çünkü "hesabını kaydet" o ekrandan da tetiklenebilir.
  const authModalNode = authOpen && (
    <Suspense fallback={<OverlayFallback z={80} />}>
      <AuthModal
        open={authOpen}
        accent={mode.accent}
        onClose={() => {
          setAuthOpen(false);
          setAuthContext(null); // bir sonraki düz "Giriş Yap" açılışına AI mesajı SIZMASIN
        }}
        onSignIn={auth.signIn}
        onSignUp={auth.isAnonymous ? auth.upgradeAnonymousAccount : auth.signUp}
        onGoogle={auth.isAnonymous ? auth.linkGoogleIdentity : auth.signInWithGoogle}
        onSuccess={() => {
          setAuthOpen(false);
          setAuthContext(null);
        }}
        isAnonymousUpgrade={auth.isAnonymous}
        contextMessage={authContext}
      />
    </Suspense>
  );

  // Nexus link paylaşımı (`/t/:templateId`) — bu SPA'da react-router gibi bir
  // kütüphane yok; tek bir statik deep-link giriş noktası için tüm `stage`
  // durum makinesini bir router'a taşımak orantısız olurdu. Bunun yerine
  // `window.location.pathname` TEK SEFERLİK (mount anında) ayrıştırılır —
  // eşleşirse normal uygulama kabuğu YERİNE SharedTemplateView render edilir.
  // ÖNEMLİ: bu erken `return`, TÜM hook'lardan (yukarıdaki useState/useEffect/
  // useCallback) SONRA gelir — React'in "hook'lar her render'da aynı sırada
  // çağrılmalı" kuralına uyulur, yalnızca JSX çıktısı koşullu değişir.
  if (sharedTemplateId) {
    return (
      <>
        <SharedTemplateView idOrSlug={sharedTemplateId} auth={auth} onOpenAuth={openAuth} onDone={handleSharedTemplateDone} />
        {authModalNode}
      </>
    );
  }

  return (
    <div className="w-full" style={{ background: "var(--bg-app)" }}>
      {/* Atmosferik animasyonlu dağ/topoğrafya + neon şerit arka planı (içeriğin
          arkasında) — ambient glow rengi aktif kategoriye göre (intro'da seçili
          sekme, plan içindeyken planın kendi kategorisi) yumuşakça değişir. */}
      <BackgroundScene category={ps.category} suspended={anyOverlayOpen} />

      {/* Mobilde intro tek ekrana kilitli (h-100dvh, scroll yok); md'den itibaren serbest. */}
      <div
        className={`relative z-10 flex flex-col text-[var(--text-primary)] ${
          onIntroLike
            ? "h-[100dvh] overflow-hidden md:h-auto md:min-h-screen md:overflow-visible"
            : "min-h-[100dvh]"
        }`}
      >
        {/* Misafir şeridi — Header'ın (sticky top-0 z-20) hemen ÜSTÜNDE DOM
            sırasıyla, kendisi de sticky top-0 z-30: art arda gelen sticky
            elemanlar tarayıcıda üst üste istiflenir, Header'ın piksel
            yüksekliğini bilmeye gerek kalmaz (bkz. GuestBanner.jsx yorumu). */}
        {auth.isAnonymous && <GuestBanner onUpgrade={openAuth} />}

        <Header
          modeAccent={mode.accent}
          modeAccentSoft={mode.accentSoft}
          user={auth.user}
          tasksActive={taskDrawerOpen}
          onTasksClick={toggleTaskDrawer}
          routinesActive={routinesOpen}
          onRoutinesClick={toggleRoutines}
          hubActive={hubOpen}
          onHubClick={toggleHub}
          plansActive={plansOpen}
          onPlansClick={togglePlans}
          rhythmActive={rhythmOpen}
          onRhythmClick={toggleRhythm}
          communityActive={communityOpen}
          onCommunityClick={toggleCommunity}
          pomodoroActive={pomodoroOpen}
          onPomodoroClick={togglePomodoro}
          onAuthClick={openAuth}
          onSignOut={requestSignOut}
          onLogoClick={onLogoClick}
          menuOpen={ps.menuOpen}
          onMenuToggle={toggleHamburger}
        />

        <DrawerMenu
          open={ps.menuOpen}
          onClose={closeHamburger}
          accent={mode.accent}
          user={auth.user}
          planGoal={ps.dbPlan?.summary}
          savedPlansCount={ps.savedPlans.length}
          onNewPlan={ps.startNewPlan}
          onDeletePlan={onDeletePlan}
          onOpenHub={toggleHub}
          onOpenTasks={toggleTaskDrawer}
          onOpenRoutines={toggleRoutines}
          onOpenPlans={togglePlans}
          onOpenRhythm={toggleRhythm}
          onOpenCommunity={toggleCommunity}
          onOpenPomodoro={togglePomodoro}
          onOpenProfile={openNexusProfile}
          onSignOut={requestSignOut}
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
          {/* Plan oluşturma/görüntüleme akışının TAMAMI (intro/soru/hazır plan)
              BURADA izole edilir — AI'dan gelen beklenmedik/bozuk bir veri
              şekli ya da render hatası TÜM UYGULAMAYI (hamburger menü, AI
              Koç widget'ı, açık diğer state) DEĞİL, yalnızca bu alanı
              etkiler. "Yeniden Dene" tam sayfa yenilemesi GEREKTİRMEZ. */}
          <ScopedErrorBoundary
            scope="plan-creation-flow"
            message="Plan oluşturulurken beklenmedik bir hata oluştu. Tekrar dener misin?"
            onReset={ps.resetToIntro}
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
              <Suspense fallback={<InlineFallback />}>
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
              </Suspense>
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
          </ScopedErrorBoundary>
        </main>
      </div>

      {/* Görevler ve Planlar (soldan kayan neon çekmece) — koşullu mount:
          kapalıyken DOM'da hiç yok. */}
      {taskDrawerOpen && (
        <Suspense fallback={<OverlayFallback z={99} />}>
          <TaskDrawer
            open={taskDrawerOpen}
            userId={auth.user?.id}
            onClose={() => setTaskDrawerOpen(false)}
            onOpenRhythm={() => {
              setTaskDrawerOpen(false);
              setRhythmOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* Rutinler popover'ı — koşullu mount. */}
      {routinesOpen && (
        <Suspense fallback={<OverlayFallback z={70} />}>
          <RoutinesPopover open={routinesOpen} userId={auth.user?.id} onClose={() => setRoutinesOpen(false)} />
        </Suspense>
      )}

      {/* Giriş/Kayıt modalı — koşullu mount. */}
      {authModalNode}

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

      {/* Şablon Keşfet — hazır rota kütüphanesi. Koşullu mount. */}
      {hubOpen && (
        <Suspense fallback={<OverlayFallback z={90} />}>
          <TemplateHub open={hubOpen} onClose={() => setHubOpen(false)} onUseTemplate={ps.startFromTemplate} />
        </Suspense>
      )}

      {/* Planlarım — tüm kayıtlı planlar, ilerlemeleriyle. Koşullu mount. */}
      {plansOpen && (
        <Suspense fallback={<OverlayFallback z={90} />}>
          <MyPlansHub
            open={plansOpen}
            userId={auth.user?.id}
            onOpenPlan={ps.openSavedPlan}
            onClose={() => setPlansOpen(false)}
          />
        </Suspense>
      )}

      {/* Pomodoro & Focus Studio — BİLEREK UNCONDITIONAL mount (Görünüm
          İzolasyonu'nun tek istisnası): sayacı Date.now() tabanlı hedef
          bitiş zaman damgasıyla çalışır (bkz. PomodoroStudio.jsx
          CountdownDisplay) — Studio kapalıyken de `running` true kaldığı
          sürece GERÇEK ZAMANDA saymaya devam etmesi gerekir. Koşullu mount
          edilirse her kapanışta unmount olup sayaç state'ini kaybederdi.
          Görünürlük `display:none` ile yönetilir (bkz. o dosyadaki kök
          döngü yorumu) — DOM bir kez kurulur, gizliyken tarayıcı layout/
          paint/animasyon maliyeti sıfıra yakındır, yalnızca zamanlayıcının
          kendi JS interval'i (bilinçli olarak) çalışmaya devam eder. */}
      <Suspense fallback={null}>
        <PomodoroStudio open={pomodoroOpen} userId={auth.user?.id} initialTask={pomodoroInitialTask} onClose={() => setPomodoroOpen(false)} />
      </Suspense>

      {/* 🌙 Ritim & Gün Sonu — AI günlük rapor + gün sonu otomatik ölçekleme +
          analitik grafikler. Koşullu mount: kapalıyken 4 SVG grafiğin hiçbiri
          DOM'da/bellekte değil, hiçbir fetch/hesaplama tetiklenmez. */}
      {rhythmOpen && (
        <Suspense fallback={<OverlayFallback z={90} />}>
          <RhythmStudio open={rhythmOpen} userId={auth.user?.id} onClose={() => setRhythmOpen(false)} />
        </Suspense>
      )}

      {/* Routinix Nexus — tam performans izolasyonu: koşullu mount, kapalıyken
          tek bir bayt bile ana pakete dahil değil (React.lazy) ve DOM'da/
          bellekte hiçbir iz kalmaz. "Planlarıma Ekle" artık AI'ı YENİDEN
          TETİKLEMEZ — communityService.cloneTemplateToMyPlans ile ANINDA
          kopyalanan planı doğrudan usePlanStudio.openSavedPlan ile açar. */}
      {communityOpen && (
        <Suspense fallback={<OverlayFallback z={100} />}>
          <CommunityHub open={communityOpen} user={auth.user} onClose={() => setCommunityOpen(false)} onPlanCloned={ps.openSavedPlan} />
        </Suspense>
      )}

      {/* "Nexus Profilim" tam ekran overlay — DrawerMenu'nün "Profil &
          İstatistikler" kartından açılır, ağır CommunityHub'ı hiç monte
          etmeden yalnızca kimlik/istatistik verisini çeker. */}
      {nexusProfileOpen && (
        <Suspense fallback={<OverlayFallback z={110} />}>
          <NexusProfileOverlay
            open={nexusProfileOpen}
            user={auth.user}
            onClose={() => setNexusProfileOpen(false)}
            onCreateProfile={() => {
              setNexusProfileOpen(false);
              toggleCommunity();
            }}
          />
        </Suspense>
      )}

      {/* AI Koç — yalnızca PlanBoard ekranındayken (yalnızca `dbPlan` kontrolü
          yetersizdi: "‹ Ana Sayfa" ile intro'ya dönünce dbPlan temizlenmediği
          için widget CategoryIntro/OnboardingWizard'ın alt sticky "Başla" /
          "Planı Oluştur" butonunun üzerine biniyordu). */}
      {stage === STAGE_PLAN && ps.dbPlan && (
        <Suspense fallback={<FabFallback />}>
          <AiCoachWidget
            plan={ps.dbPlan}
            userId={auth.user?.id}
            isAnonymous={auth.isAnonymous}
            onRequireAuth={requireAuth}
            onApplyAction={ps.applyCoachAction}
            onSendMessage={ps.sendCoachMessage}
            onJumpToPlan={ps.openSavedPlan}
          />
        </Suspense>
      )}

      {/* Mobilde yüzen bir Pomodoro butonu YOK — ekranın üzerinde gezinip
          sıkışıklık yaratıyordu. Pomodoro, DrawerMenu'nün "Hızlı Erişim"
          gridinden (mobil) ve Header'dan (masaüstü) zaten erişilebilir. */}

      {/* PDF / Yazdır — aralık seçimi + yazdır */}
      <Suspense fallback={null}>
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
      </Suspense>

      <GlobalStyles />
    </div>
  );
}
