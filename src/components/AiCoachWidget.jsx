import { useState, useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { categoryOf } from "../constants";
import { fetchDashboardData } from "../services/planService";
import { callCoachAction } from "../services/coachActionService";
import logger from "../utils/logger";

const QUICK_ACTIONS = [
  { key: "lighten", emoji: "📉", label: "Planı Hafiflet", hint: "Zor görevleri kısalt" },
  { key: "intensify", emoji: "🔥", label: "Tempoyu Sıkılaştır", hint: "Daha yoğun bir tempo" },
  { key: "postponeToday", emoji: "☕", label: "Bugün Çok Yoruldum", hint: "Kalanları yarına kaydır" },
  { key: "analyze", emoji: "📊", label: "Gidişatımı Analiz Et", hint: "Durum özeti al" },
];

function Bubble({ role, text, error, jumpPlan, onJump }) {
  const isBot = role === "bot";
  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[85%] flex flex-col gap-1.5 items-start">
        <div
          className="rounded-2xl px-3.5 py-2.5 text-[13px] font-medium leading-relaxed"
          style={
            error
              ? { background: "rgba(244,64,107,0.12)", border: "1px solid rgba(244,64,107,0.35)", color: "var(--coach-error-text)", borderTopLeftRadius: 4 }
              : isBot
                ? { background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.28)", color: "var(--coach-text)", borderTopLeftRadius: 4 }
                : { background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", borderTopRightRadius: 4 }
          }
        >
          {text}
        </div>
        {jumpPlan && (
          <button
            onClick={() => onJump(jumpPlan.id)}
            className="ml-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors"
            style={{ background: "rgba(124,58,237,0.15)", color: "var(--coach-text)", border: "1px solid rgba(124,58,237,0.35)" }}
          >
            ↳ "{jumpPlan.title}" planını görüntüle
          </button>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 rounded-2xl px-4 py-3"
        style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.28)", borderTopLeftRadius: 4 }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: "var(--coach-text)" }} />
        ))}
      </div>
    </div>
  );
}

// Yüzen AI Koç widget'ı (lucide "Bot" ikonu, mor→indigo→cyan gradient) — sağ
// alt köşede sabit tetikleyici + sağdan açılan
// glassmorphism sohbet çekmecesi. Hazır aksiyon çipleri VE serbest metin
// ikisi de usePlanStudio üzerinden gerçek Supabase mutasyonları tetikler.
// Kullanıcının TÜM planları arasında bir "hedef plan" seçilebilir (dropdown);
// AI da serbest metinden hangi planı kastettiğini kendi tespit edebilir.
export default function AiCoachWidget({ plan, userId, onApplyAction, onSendMessage, onJumpToPlan }) {
  const [open, setOpen] = useState(false);
  // Hak sayısı artık YALNIZCA sunucudan (api/coach-action.js -> user_quotas)
  // gelir — localStorage tabanlı sayaç kaldırıldı (DevTools'tan silinerek
  // sıfırlanabiliyordu). null = henüz bilinmiyor (drawer açılana kadar).
  const [remaining, setRemaining] = useState(null);
  const [dailyLimit, setDailyLimit] = useState(3);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [allPlans, setAllPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(plan?.id || null);
  const scrollRef = useRef(null);

  // Drawer her açıldığında güncel hak durumunu sunucudan çek.
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    callCoachAction({ action: "status" })
      .then((res) => {
        if (cancelled || !res) return;
        if (typeof res.remaining === "number") setRemaining(res.remaining);
        if (typeof res.dailyLimit === "number") setDailyLimit(res.dailyLimit);
      })
      .catch((err) => logger.error("AI_COACH", "Hak durumu alınamadı", { error: err?.message }));
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // Board'da açık plan değişirse (ör. MyPlansHub'dan başka plan açıldıysa)
  // koçun varsayılan hedefini de o plana senkronla.
  useEffect(() => {
    setSelectedPlanId(plan?.id || null);
  }, [plan?.id]);

  // Drawer açıldığında kullanıcının TÜM planlarını çek — hem plan seçici
  // dropdown'u doldurmak hem de AI'a "multi-plan" bağlamı vermek için.
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    fetchDashboardData(userId)
      .then((data) => !cancelled && setAllPlans(data))
      .catch((err) => logger.error("AI_COACH", "Planlar getirilemedi (widget)", { error: err?.message }));
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "bot",
          text: `Merhaba! "${plan?.title || "planın"}" ile ilgili sana nasıl yardımcı olabilirim? Hızlı aksiyonlardan birini seçebilir ya da doğrudan yazabilirsin — istersen üstteki menüden başka bir planı da konuşabiliriz. ✨`,
        },
      ]);
    }
  }, [open, messages.length, plan?.title]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const locked = remaining !== null && remaining <= 0;
  const displayRemaining = remaining ?? dailyLimit;
  const pushMessage = (msg) => setMessages((prev) => [...prev, msg]);
  const planOptions = allPlans.length ? allPlans : plan ? [plan] : [];
  const selectedPlan = planOptions.find((p) => p.id === selectedPlanId) || plan;

  const handleJump = (planId) => {
    setOpen(false);
    onJumpToPlan?.(planId);
  };

  // Hazır aksiyon çipleri — her zaman ekranda açık olan planı hedefler.
  // Hak kontrolü/düşümü artık sunucuda (api/coach-action.js); dönen
  // result.remaining/dailyLimit'i olduğu gibi yansıtıyoruz.
  const runAction = async (action) => {
    if (locked || typing) return;
    pushMessage({ role: "user", text: `${action.emoji} ${action.label}` });
    setTyping(true);
    await new Promise((r) => setTimeout(r, 550)); // premium "düşünüyor" hissi
    const result = await onApplyAction(action.key);
    setTyping(false);
    if (typeof result?.remaining === "number") setRemaining(result.remaining);
    if (typeof result?.dailyLimit === "number") setDailyLimit(result.dailyLimit);
    pushMessage({ role: "bot", text: result?.message || "Bir şeyler ters gitti, tekrar dener misin?", error: result?.ok === false });
  };

  // Serbest metin — sunucu (api/coach-action.js) kullanıcının TÜM planlarını
  // kendi service_role ile tazeden çeker ve AI'a bağlam olarak verir; widget
  // yalnızca hangi planı "dropdown"dan seçtiğini (targetPlanId ipucu) gönderir.
  const submitDraft = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (locked || typing || !text) return;
    pushMessage({ role: "user", text });
    setDraft("");
    setTyping(true);

    const result = await onSendMessage(text, { targetPlanId: selectedPlanId });
    setTyping(false);
    if (typeof result?.remaining === "number") setRemaining(result.remaining);
    if (typeof result?.dailyLimit === "number") setDailyLimit(result.dailyLimit);

    const targetedOther = result?.targetPlanId && result.targetPlanId !== plan?.id;
    const jumpPlan = targetedOther ? planOptions.find((p) => p.id === result.targetPlanId) : null;
    pushMessage({
      role: "bot",
      text: result?.message || "Bir şeyler ters gitti, tekrar dener misin?",
      error: result?.ok === false,
      jumpPlan: jumpPlan ? { id: jumpPlan.id, title: jumpPlan.title || "Plan" } : null,
    });
  };

  return (
    <>
      {/* Yüzen tetikleyici baloncuk — z-40: DrawerMenu (z-50) açıkken onun
          altında kalsın (üstüne binip tıklamayı engellemesin); alt boşluk
          safe-area'ya duyarlı (iOS home-indicator/gesture bar payı). */}
      <div
        className="fixed z-40"
        style={{ right: "1.5rem", bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="group relative flex items-center justify-end">
          <div
            className="mr-3 pointer-events-none opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap rounded-xl px-3.5 py-2 text-[12.5px] font-semibold"
            style={{
              background: "rgba(var(--glass-rgb), var(--alpha-modal))",
              backdropFilter: "blur(16px) saturate(160%)",
              WebkitBackdropFilter: "blur(16px) saturate(160%)",
              border: "1px solid var(--modal-border)",
              color: "var(--text-primary)",
            }}
          >
            ✨ AI Koç'a Danış{" "}
            <span style={{ color: locked ? "#FF6E92" : "#7DE9C3" }}>
              ({displayRemaining}/{dailyLimit} Kalan Hak)
            </span>
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="AI Koç'u aç"
            className="relative w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 ring-2 ring-violet-500/50 animate-pulse transition-transform duration-200 hover:scale-105 active:scale-95"
            style={{ boxShadow: "0 10px 34px -10px rgba(124,58,237,0.75), 0 0 24px -6px rgba(124,58,237,0.55)" }}
          >
            <Bot className="w-6 h-6 text-white drop-shadow-sm" strokeWidth={2.25} />
            {/* Canlı durum noktası */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "#2ED9A3" }} />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 border-2" style={{ background: "#2ED9A3", borderColor: "var(--bg-app)" }} />
            </span>
          </button>
        </div>
      </div>

      {/* Sohbet çekmecesi */}
      {open && (
        <>
          <div className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={() => setOpen(false)} />
          <div
            className="fixed top-0 right-0 z-[96] h-full w-[92%] max-w-[400px] flex flex-col drawer-panel"
            style={{
              background: "rgba(var(--glass-rgb), var(--alpha-modal))",
              backdropFilter: "blur(28px) saturate(160%)",
              WebkitBackdropFilter: "blur(28px) saturate(160%)",
              borderLeft: "1px solid rgba(var(--overlay-rgb), 0.10)",
              boxShadow: "-24px 0 70px -20px rgba(0,0,0,0.35), inset 1px 0 24px -12px rgba(124,58,237,0.4)",
            }}
          >
            <div className="neon-strip" />

            {/* Başlık */}
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-200 dark:border-white/8 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500"
                  style={{ boxShadow: "0 0 14px -4px rgba(124,58,237,0.7)" }}
                >
                  <Bot className="w-[18px] h-[18px] text-white" strokeWidth={2.25} />
                </div>
                <div className="text-[14px] font-bold text-slate-900 dark:text-slate-100 shrink-0">AI Koç</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors shrink-0"
                style={{ background: "rgba(var(--overlay-rgb), 0.05)" }}
              >
                ✕
              </button>
            </div>

            {/* Plan Seçici — hangi plan üzerinde konuşuluyor */}
            <div className="shrink-0 px-4 pt-2.5 pb-2 border-b border-slate-200 dark:border-white/8">
              <label className="block text-[9.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-1.5">Konuştuğun Plan</label>
              <div className="relative">
                <select
                  value={selectedPlanId || ""}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full appearance-none rounded-xl pl-3 pr-8 py-2 text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 outline-none"
                  style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.30)" }}
                >
                  {planOptions.map((p) => {
                    const cat = categoryOf(p.mode);
                    return (
                      <option key={p.id} value={p.id} style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                        {cat.emoji} {p.title || "Plan"}
                      </option>
                    );
                  })}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 dark:text-slate-500">▾</span>
              </div>
            </div>

            {/* Mesajlar */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-3">
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.text} error={m.error} jumpPlan={m.jumpPlan} onJump={handleJump} />
              ))}
              {typing && <TypingBubble />}
            </div>

            {/* Hazır aksiyon çipleri */}
            <div className="shrink-0 px-4 pt-1 pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2">
                Hızlı Aksiyonlar {selectedPlan?.id !== plan?.id ? "· ekrandaki plana uygulanır" : ""}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => runAction(a)}
                    disabled={locked || typing}
                    className="flex flex-col items-start gap-1 rounded-xl p-2.5 text-left transition-colors card-glow disabled:opacity-35 disabled:pointer-events-none"
                    style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.30)" }}
                  >
                    <span className="text-[15px]">{a.emoji}</span>
                    <span className="text-[11.5px] font-semibold leading-snug text-slate-900 dark:text-slate-100">{a.label}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">{a.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Girdi alanı / Paywall */}
            <div className="sticky-actions">
              {locked ? (
                <div
                  className="rounded-2xl p-4 text-center"
                  style={{ background: "rgba(178,107,255,0.10)", border: "1px solid rgba(178,107,255,0.35)", boxShadow: "0 0 20px -8px rgba(178,107,255,0.6)" }}
                >
                  <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 mb-1">⭐ Premium ile Sınırsız Koçluk Al</p>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                    Bugünkü {dailyLimit} ücretsiz hakkın doldu. Yarın sıfırlanır, ya da hemen sınırsız erişime geç.
                  </p>
                  <button
                    className="w-full rounded-xl py-2.5 text-[12.5px] font-semibold"
                    style={{ background: "linear-gradient(90deg, #7C3AED, #4F46E5, #06B6D4)", color: "#0b0c10" }}
                  >
                    Premium'a Geç
                  </button>
                </div>
              ) : (
                <form onSubmit={submitDraft} className="input-glow glass flex items-center gap-2 rounded-2xl p-1.5">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Örn: hipertrofi programımı yoğunlaştır..."
                    disabled={typing}
                    className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-2.5 py-1.5"
                  />
                  <button
                    type="submit"
                    disabled={typing || !draft.trim()}
                    className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40"
                    style={{ background: "linear-gradient(90deg, #7C3AED, #06B6D4)", color: "#0b0c10" }}
                  >
                    ➤
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
