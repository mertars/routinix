import { useState, useEffect, useRef } from "react";
import { AI_COACH_DAILY_LIMIT, getRemainingUses, consumeUse } from "../lib/aiCoachQuota";

const QUICK_ACTIONS = [
  { key: "lighten", emoji: "📉", label: "Planı Hafiflet", hint: "Zor görevleri kısalt" },
  { key: "intensify", emoji: "🔥", label: "Tempoyu Sıkılaştır", hint: "Daha yoğun bir tempo" },
  { key: "postponeToday", emoji: "☕", label: "Bugün Çok Yoruldum", hint: "Kalanları yarına kaydır" },
  { key: "analyze", emoji: "📊", label: "Gidişatımı Analiz Et", hint: "Durum özeti al" },
];

function Bubble({ role, text }) {
  const isBot = role === "bot";
  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"}`}>
      <div
        className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] font-medium leading-relaxed"
        style={
          isBot
            ? { background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.28)", color: "#ECE7FF", borderTopLeftRadius: 4 }
            : { background: "#161D25", border: "1px solid #232C36", color: "#ECF2F4", borderTopRightRadius: 4 }
        }
      >
        {text}
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
          <span key={i} className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: "#C4B5FD" }} />
        ))}
      </div>
    </div>
  );
}

// 🔮 Yüzen AI Koç widget'ı — sağ alt köşede sabit tetikleyici + sağdan açılan
// glassmorphism sohbet çekmecesi. Hazır aksiyon çipleri usePlanStudio.applyCoachAction'ı
// tetikler (optimistic Supabase mutasyonu); günlük 3 hak dolunca girdi kilitlenir.
export default function AiCoachWidget({ plan, userId, onApplyAction }) {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(AI_COACH_DAILY_LIMIT);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    setRemaining(getRemainingUses(userId));
  }, [userId, open]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "bot",
          text: `Merhaba! "${plan?.title || "planın"}" ile ilgili sana nasıl yardımcı olabilirim? Aşağıdaki hızlı aksiyonlardan birini seçebilirsin. ✨`,
        },
      ]);
    }
  }, [open, messages.length, plan?.title]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const locked = remaining <= 0;

  const pushMessage = (msg) => setMessages((prev) => [...prev, msg]);

  const runAction = async (action) => {
    if (locked || typing) return;
    pushMessage({ role: "user", text: `${action.emoji} ${action.label}` });
    setTyping(true);
    setRemaining(consumeUse(userId));

    // Kısa bir "düşünüyor" gecikmesi — premium/insan hissi için.
    await new Promise((r) => setTimeout(r, 550));
    const result = await onApplyAction(action.key);
    setTyping(false);
    pushMessage({ role: "bot", text: result?.message || "Bir şeyler ters gitti, tekrar dener misin?" });
  };

  const submitDraft = (e) => {
    e.preventDefault();
    if (locked || typing || !draft.trim()) return;
    pushMessage({ role: "user", text: draft.trim() });
    setDraft("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      pushMessage({ role: "bot", text: "Şu an yalnızca hızlı aksiyonları destekliyorum — birini seç, sana hemen yardımcı olayım 👇" });
    }, 450);
  };

  return (
    <>
      {/* Yüzen tetikleyici baloncuk */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="group relative flex items-center justify-end">
          <div
            className="mr-3 pointer-events-none opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap rounded-xl px-3.5 py-2 text-[12.5px] font-semibold"
            style={{
              background: "rgba(15,20,27,0.94)",
              backdropFilter: "blur(16px) saturate(160%)",
              WebkitBackdropFilter: "blur(16px) saturate(160%)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#ECF2F4",
            }}
          >
            ✨ AI Koç'a Danış{" "}
            <span style={{ color: locked ? "#FF6E92" : "#7DE9C3" }}>
              ({remaining}/{AI_COACH_DAILY_LIMIT} Kalan Hak)
            </span>
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="AI Koç'u aç"
            className="relative w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 ring-2 ring-violet-500/50 animate-pulse"
            style={{ boxShadow: "0 10px 34px -10px rgba(124,58,237,0.75)" }}
          >
            <span className="text-[22px] leading-none">🔮</span>
            {/* Canlı durum noktası */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "#2ED9A3" }} />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 border-2" style={{ background: "#2ED9A3", borderColor: "#0b0c10" }} />
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
              background: "rgba(2,3,8,0.95)",
              backdropFilter: "blur(28px) saturate(160%)",
              WebkitBackdropFilter: "blur(28px) saturate(160%)",
              borderLeft: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "-24px 0 70px -20px rgba(0,0,0,0.75), inset 1px 0 24px -12px rgba(124,58,237,0.4)",
            }}
          >
            <div className="neon-strip" />

            {/* Başlık */}
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500"
                  style={{ boxShadow: "0 0 14px -4px rgba(124,58,237,0.7)" }}
                >
                  <span className="text-[16px]">🔮</span>
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-slate-100">AI Koç</div>
                  <div className="text-[11px] text-slate-400 truncate">{plan?.title || "Planın"}</div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors shrink-0"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                ✕
              </button>
            </div>

            {/* Mesajlar */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-3">
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.text} />
              ))}
              {typing && <TypingBubble />}
            </div>

            {/* Hazır aksiyon çipleri */}
            <div className="shrink-0 px-4 pt-1 pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2">Hızlı Aksiyonlar</p>
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
                    <span className="text-[11.5px] font-semibold leading-snug text-slate-100">{a.label}</span>
                    <span className="text-[10px] text-slate-400 leading-snug">{a.hint}</span>
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
                  <p className="text-[13px] font-bold text-slate-100 mb-1">⭐ Premium ile Sınırsız Koçluk Al</p>
                  <p className="text-[11.5px] text-slate-400 leading-relaxed mb-3">
                    Bugünkü {AI_COACH_DAILY_LIMIT} ücretsiz hakkın doldu. Yarın sıfırlanır, ya da hemen sınırsız erişime geç.
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
                    placeholder="Bir mesaj yaz..."
                    disabled={typing}
                    className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-slate-100 placeholder:text-slate-500 px-2.5 py-1.5"
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
