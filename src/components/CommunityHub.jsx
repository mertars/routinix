import { useState, useEffect, memo, lazy, Suspense } from "react";
import { X, Search, Plus, Users, Sparkles } from "lucide-react";
import useDebounce from "../hooks/useDebounce";
import { CATEGORIES, CATEGORY_KEYS } from "../constants";
import { ALL_PRESET_TAGS } from "../data/communityTags";
import { fetchTemplates } from "../services/communityService";
import { ensureOwnProfile, fetchProfileByAuthUserId, fetchFollowingIds, isValidUsername } from "../services/profileService";
import TemplateCard, { TemplateEmptyState } from "./community/TemplateCard";
import GuidedTemplateForm from "./community/GuidedTemplateForm";
import TemplateDetailModal from "./community/TemplateDetailModal";
import PublicProfileCard from "./community/PublicProfileCard";
import logger from "../utils/logger";

// WeeklyFlowModal ayrı bir chunk'ta (bkz. lazy) — `html-to-image` bağımlılığı
// (PNG dışa aktarım) yalnızca kullanıcı gerçekten "Haftalık Özeti Gör"e
// tıklarsa indirilir, Nexus'un kendi bundle'ını şişirmez.
const WeeklyFlowModal = lazy(() => import("./WeeklyFlowModal"));

// Ambient nöon zemin — TAMAMEN STATİK: hiçbir `animation`, hiçbir
// `filter: blur()` yok. Önceki sürüm 3 adet sürekli `animation: ... infinite`
// döngüsüyle `filter: blur(120px)` uygulayan blob'lar kullanıyordu — ikisi
// birlikte (özellikle entegre Mac GPU'larında) sürekli compositor/GPU
// meşguliyetine, dolayısıyla fan/ısınmaya yol açıyordu. Aynı görsel "yumuşak
// ışık havuzu" hissi, blur'a hiç ihtiyaç duymayan `radial-gradient`in doğal
// yumuşak kenarlarıyla, TEK bir statik katmanda (bir kere paint edilir, bir
// daha asla yeniden hesaplanmaz) elde edilir. `will-change`/`transform-gpu`
// BİLEREK eklenmedi — hareket etmeyen bir katmana bunları eklemek, tarayıcıyı
// hiçbir zaman kullanılmayacak bir compositor katmanı tutmaya zorlar (net
// kazanç değil, saf israf).
const NEXUS_BACKGROUND_STYLE = {
  background: [
    "radial-gradient(circle at 8% -6%, rgba(178,107,255,0.28) 0%, transparent 45%)",
    "radial-gradient(circle at 96% 108%, rgba(34,211,238,0.24) 0%, transparent 45%)",
    "radial-gradient(circle at 78% 38%, rgba(16,185,129,0.14) 0%, transparent 40%)",
    "var(--bg-app)",
  ].join(", "),
};

const NexusBackground = memo(function NexusBackground() {
  return <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" style={NEXUS_BACKGROUND_STYLE} />;
});

// Routinix Nexus — TAMAMEN İZOLE bir alt-uygulama.
//
// İZOLASYON: app.jsx'te bu bileşen KOŞULLU mount edilir (`{communityOpen &&
// <Suspense><CommunityHub/></Suspense>}`) — panel kapanır kapanmaz TÜMÜYLE
// unmount olur, hiçbir fetch/interval/listener arkada kalmaz. Kendi başına
// yeterlidir: `user` (auth kullanıcısı) ve `onPlanCloned` (bir şablon "Planlarıma
// Ekle" ile anında kopyalanınca çağrılır — usePlanStudio.openSavedPlan'e
// bağlanır, yeni planı doğrudan açar) alır.
export default function CommunityHub({ open, user, onClose, onPlanCloned, onLimitReached }) {
  const [myProfile, setMyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [creatingProfile, setCreatingProfile] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [followingOnly, setFollowingOnly] = useState(false);
  const [followingIds, setFollowingIds] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [detailTemplate, setDetailTemplate] = useState(null);
  const [profileCardTarget, setProfileCardTarget] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [weeklyFlowOpen, setWeeklyFlowOpen] = useState(false);
  // Mobil arama/etiket şeridi scroll'a duyarlı (yalnızca lg altında GÖRÜNÜR
  // zaten — bkz. aşağıdaki "lg:hidden" sarmalayıcı; masaüstünde bu state hiç
  // görsel etkiye sahip değil, ayrı bir "responsive guard" gerekmez). 5-50px
  // arası bilerek bir "histerezis" bölgesidir — tam eşikte ileri geri
  // titremeyi (flicker) önler.
  const [mobileBarCollapsed, setMobileBarCollapsed] = useState(false);
  const handleContentScroll = (e) => {
    const top = e.currentTarget.scrollTop;
    setMobileBarCollapsed((prev) => {
      if (top > 50) return prev ? prev : true;
      if (top <= 4) return prev ? false : prev;
      return prev;
    });
  };

  useEffect(() => {
    if (!open || !user) {
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    fetchProfileByAuthUserId(user.id)
      .then((p) => !cancelled && setMyProfile(p))
      .finally(() => !cancelled && setProfileLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  useEffect(() => {
    if (!followingOnly || !myProfile) return;
    let cancelled = false;
    fetchFollowingIds(myProfile.id).then((ids) => !cancelled && setFollowingIds(ids));
    return () => {
      cancelled = true;
    };
  }, [followingOnly, myProfile]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setFetchError("");
    fetchTemplates({
      search: debouncedSearch,
      tags: selectedTags,
      category: selectedCategory,
      authorIds: followingOnly ? followingIds : null,
    })
      .then((rows) => !cancelled && setTemplates(rows))
      .catch((err) => {
        logger.error("COMMUNITY_HUB", "Şablonlar getirilemedi", { error: err?.message });
        if (!cancelled) setFetchError(err?.message || "Şablonlar getirilemedi.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, debouncedSearch, selectedTags, selectedCategory, followingOnly, followingIds]);

  if (!open) return null;

  const toggleTagFilter = (t) => setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleCreateProfile = async () => {
    if (!isValidUsername(usernameDraft)) {
      setUsernameError("3-24 karakter, yalnızca küçük harf/rakam/alt çizgi.");
      return;
    }
    setCreatingProfile(true);
    setUsernameError("");
    try {
      const p = await ensureOwnProfile(user, usernameDraft);
      setMyProfile(p);
    } catch (err) {
      setUsernameError(err?.message || "Bir sorun oluştu.");
    } finally {
      setCreatingProfile(false);
    }
  };

  const handleClone = (plan) => {
    setDetailTemplate(null);
    onPlanCloned?.(plan.id);
    onClose();
  };

  const handleFollowChange = (targetId, nowFollowing) => {
    setFollowingIds((prev) => {
      if (!prev) return prev;
      return nowFollowing ? [...prev, targetId] : prev.filter((id) => id !== targetId);
    });
  };

  const CategorySidebar = (
    <>
      {myProfile && (
        <button
          onClick={() => setFollowingOnly((v) => !v)}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12px] font-bold border transition-colors duration-200 ${
            followingOnly ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Takip Edilenler
        </button>
      )}

      <div>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--text-faint)] mb-2">Kategori</p>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`text-left rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors duration-200 ${!selectedCategory ? "bg-[rgba(var(--overlay-rgb),0.1)] text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
          >
            Tümü
          </button>
          {CATEGORY_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setSelectedCategory(k)}
              className={`text-left rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors duration-200 ${selectedCategory === k ? "bg-[rgba(var(--overlay-rgb),0.1)] text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
            >
              {CATEGORIES[k].emoji} {CATEGORIES[k].label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const TagChipsRow = (
    <div className="edge-fade-x flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
      {ALL_PRESET_TAGS.map((t) => {
        const active = selectedTags.includes(t);
        return (
          <button
            key={t}
            onClick={() => toggleTagFilter(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-colors duration-200 ${
              active ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-[var(--border-default)] text-[var(--text-secondary)]"
            }`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col text-[var(--text-primary)]">
      <NexusBackground />
      <div className="relative z-10 flex flex-col h-full">
        <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-3 flex items-center justify-between gap-2 border-b border-[var(--border-default)]">
          <h2 className="text-[17px] font-bold">Routinix Nexus</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => myProfile && setShowCreateForm(true)}
              disabled={!myProfile}
              className="flex items-center gap-1.5 rounded-full px-3.5 h-9 text-[12px] font-bold text-black disabled:opacity-40 transition-all active:scale-95"
              style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Nexus'ta Paylaş
            </button>
            <button onClick={onClose} aria-label="Kapat" className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {user && (
          <button
            onClick={() => setWeeklyFlowOpen(true)}
            className="shrink-0 mx-4 sm:mx-6 lg:mx-8 mt-3 flex items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-violet-500/10 px-4 py-2.5 text-left transition-colors hover:border-cyan-500/50"
          >
            <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-cyan-200">
              <Sparkles className="w-3.5 h-3.5" /> Haftalık Özeti Gör
            </span>
            <span className="text-[10.5px] text-[var(--text-muted)] hidden sm:inline">Bu haftaki verimlilik karnen hazır →</span>
          </button>
        )}

        {!profileLoading && user && !myProfile && (
          <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-3 border-b border-[var(--border-default)] flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-[var(--text-muted)]">Nexus'a katılmak için bir kullanıcı adı seç:</span>
            <input
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value.toLowerCase())}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProfile()}
              placeholder="kullanici_adi"
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={handleCreateProfile}
              disabled={creatingProfile}
              className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg text-black disabled:opacity-50"
              style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
            >
              {creatingProfile ? "..." : "Oluştur"}
            </button>
            {usernameError && <span className="text-[11px] text-red-400">{usernameError}</span>}
          </div>
        )}

        {/* Mobil: üstte arama + kategori/etiket çipleri — aşağı kaydırınca
            (scrollTop > 50) yumuşakça yukarı katlanır, yerine sağda küçük bir
            arama ikonu belirir; en üste dönünce (scrollTop <= 4) otomatik
            geri açılır. Masaüstünde bu bloğun TAMAMI `lg:hidden` — collapse
            state'inin orada hiçbir görsel karşılığı yok, ayrı bir "desktop'ta
            çalışmasın" kontrolüne gerek kalmaz. `max-height` + `opacity` +
            `translate-y` geçişi: her iki taraf da SABİT bir max-height'a
            (içeriğin gerçek boyundan cömertçe büyük) katlanıp açılıyor —
            JS ile yükseklik ölçmeye gerek yok, tamamen CSS transition. */}
        <div className="lg:hidden shrink-0 border-b border-[var(--border-default)]">
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              mobileBarCollapsed ? "max-h-0 opacity-0 -translate-y-2" : "max-h-[240px] opacity-100 translate-y-0"
            }`}
          >
            <div className="px-4 sm:px-6 pt-3 pb-2 flex flex-col gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Şablon ara..."
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] pl-9 pr-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="edge-fade-x flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {myProfile && (
                  <button
                    onClick={() => setFollowingOnly((v) => !v)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-colors duration-200 ${
                      followingOnly ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-[var(--border-default)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <Users className="w-3 h-3" /> Takip Edilenler
                  </button>
                )}
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-colors duration-200 ${!selectedCategory ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`}
                >
                  Tümü
                </button>
                {CATEGORY_KEYS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setSelectedCategory(k)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-colors duration-200 ${selectedCategory === k ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`}
                  >
                    {CATEGORIES[k].emoji} {CATEGORIES[k].label}
                  </button>
                ))}
              </div>
              {TagChipsRow}
            </div>
          </div>

          {/* Katlanınca beliren küçük arama tetikleyicisi */}
          <div className={`overflow-hidden transition-all duration-300 ease-out ${mobileBarCollapsed ? "max-h-14 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="flex items-center justify-end px-4 sm:px-6 py-2">
              <button
                onClick={() => setMobileBarCollapsed(false)}
                aria-label="Aramayı ve etiketleri aç"
                className="w-9 h-9 rounded-full flex items-center justify-center border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-cyan-500/40 transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden" onScroll={handleContentScroll}>
          <div className="lg:flex lg:h-full">
            {/* Masaüstü: sol sabit filtre paneli — YALNIZCA ana kategoriler
                (spesifik etiketler artık sağdaki yatay çip şeridinde). */}
            <div className="hidden lg:flex lg:w-56 shrink-0 border-r border-[var(--border-default)] p-5 flex-col gap-5 overflow-y-auto no-scrollbar">{CategorySidebar}</div>

            {/* `min-w-0` KRİTİK: bu bir flex item'ı (üst parent `lg:flex`) —
                flex item'lar VARSAYILAN OLARAK `min-width: auto` taşır, yani
                içeriği (auto-fit grid'i "sığdığı kadar kolon" isteyince)
                mevcut alandan DAHA GENİŞ olmak isterse flex item KÜÇÜLMEYİ
                REDDEDER ve sağa taşar. `min-w-0` bu varsayılanı iptal eder —
                asıl taşma/sıkışma hatasının kök nedeni buydu, max-width'in
                kendisi değil. */}
            <div className="flex-1 min-h-0 min-w-0 lg:flex lg:flex-col">
              {/* Masaüstü: arama + yatay etiket çipleri, sidebar'ın DIŞINDA */}
              <div className="hidden lg:flex lg:flex-col gap-2 px-8 pt-4 pb-2 shrink-0">
                <div className="relative max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Şablon ara..."
                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] pl-9 pr-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
                {TagChipsRow}
              </div>

              {/* 3'lü grid (masaüstü) / dikey akış (mobil) */}
              <div className="flex-1 min-h-0 min-w-0 lg:overflow-y-auto p-4 sm:p-6 lg:px-8 lg:pb-8 pb-mobile-safe w-full max-w-[1400px] mx-auto">
                {loading ? (
                  <p className="text-[12.5px] text-[var(--text-muted)] text-center py-16">Yükleniyor...</p>
                ) : fetchError ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                    <p className="text-[13px] font-semibold text-red-400 max-w-[420px]">Şablonlar yüklenemedi</p>
                    <p className="text-[11.5px] text-[var(--text-muted)] max-w-[420px] font-mono break-words">{fetchError}</p>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="grid grid-cols-1">
                    <TemplateEmptyState message={followingOnly ? "Henüz kimseyi takip etmiyorsun — bir yazarın profilinden takip etmeyi dene." : undefined} />
                  </div>
                ) : (
                  // Tailwind breakpoint'leri (sm:/md:/lg:) VIEWPORT genişliğine bakar —
                  // tarayıcının kendi kenar çubuğu (bkz. Opera sidebar) veya bu
                  // uygulamanın sol paneli viewport'u küçültünce, grid konteynerinin
                  // GERÇEKTE ne kadar yer kapladığından bağımsız olarak breakpoint hiç
                  // tetiklenmeyebiliyordu. `auto-fit` + `minmax`, viewport'u değil grid
                  // KONTEYNERİNİN kendi render genişliğini baz alır. `max-w-[1400px]
                  // mx-auto` (üstteki sarmalayıcı) çok geniş monitörlerde kolon
                  // sayısının aşırı artmasını/kartların "kağıt gibi" incelmesini
                  // önler; taşma hatasının asıl kök nedeni ise `min-w-0` eksikliğiydi
                  // (yukarıdaki flex zincirine bkz.) — auto-fit'in kendisi DEĞİL.
                  <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                    {templates.map((t) => (
                      <TemplateCard key={t.id} template={t} onOpen={setDetailTemplate} onOpenAuthor={setProfileCardTarget} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <GuidedTemplateForm
          open={showCreateForm && !!myProfile}
          authorProfileId={myProfile?.id}
          userId={user?.id}
          onClose={() => setShowCreateForm(false)}
          onCreated={(created) => {
            setShowCreateForm(false);
            setTemplates((prev) => [{ ...created, author: myProfile, stats: { like_count: 0, clone_count: 0, comment_count: 0 } }, ...prev]);
          }}
        />

        {detailTemplate && (
          <TemplateDetailModal
            template={detailTemplate}
            myProfile={myProfile}
            userId={user?.id}
            authUserCreatedAt={user?.created_at}
            onClose={() => setDetailTemplate(null)}
            onOpenAuthor={(author) => {
              setDetailTemplate(null);
              setProfileCardTarget(author);
            }}
            onClone={handleClone}
            onLimitReached={onLimitReached}
          />
        )}

        {profileCardTarget && (
          <PublicProfileCard
            profile={profileCardTarget}
            myProfile={myProfile}
            onClose={() => setProfileCardTarget(null)}
            onFollowChange={handleFollowChange}
            onOpenTemplate={(t) => {
              setProfileCardTarget(null);
              setDetailTemplate(t);
            }}
          />
        )}

        {weeklyFlowOpen && (
          <Suspense fallback={null}>
            <WeeklyFlowModal open={weeklyFlowOpen} user={user} profile={myProfile} onClose={() => setWeeklyFlowOpen(false)} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
