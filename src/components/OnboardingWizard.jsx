import { MONO_FONT } from "../constants";

// Dinamik onboarding sihirbazı: aiPipelineService.generateOnboardingQuestions'ın
// ürettiği kategori+hedefe özel soruları adım adım sorar. "choice" tipi şıklarla,
// "text" tipi serbest metinle cevaplanır. Cevaplar üst state'te (answers) tutulur
// ve son adımda plan üretiminin AI bağlamına eklenir.
export default function OnboardingWizard({
  accent,
  accentSoft,
  questions,
  wizardStep,
  currentAnswer,
  onSetAnswer,
  onPrev,
  onNext,
  onFinish,
}) {
  const total = questions.length;
  const q = questions[wizardStep];
  if (!q) return null;

  const isLast = wizardStep === total - 1;
  const isText = q.type === "text";
  // Metin sorularında boş cevap geçilebilir (opsiyonel); şıklı sorularda seçim şart.
  const canProceed = isText ? true : !!currentAnswer;
  const progressPct = Math.round(((wizardStep + 1) / total) * 100);

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.35s_ease]">
      {/* İlerleme */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: accent, fontFamily: MONO_FONT }}>
            Soru {String(wizardStep + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span className="text-[11px] font-medium text-[var(--text-faint)]" style={{ fontFamily: MONO_FONT }}>
            %{progressPct}
          </span>
        </div>
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "var(--disabled-bg)" }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: i <= wizardStep ? "100%" : "0%", background: accent }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Soru kartı */}
      <div
        key={wizardStep}
        className="rounded-2xl border p-5 flex flex-col gap-4 animate-[slideIn_0.3s_ease]"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
      >
        <h2 className="text-[18px] font-bold leading-snug text-balance text-[var(--text-primary)]">{q.title}</h2>

        {isText ? (
          <textarea
            value={currentAnswer || ""}
            onChange={(e) => onSetAnswer(e.target.value)}
            placeholder="Cevabını buraya yaz... (opsiyonel)"
            rows={3}
            className="input-glow w-full rounded-xl border p-3.5 bg-transparent resize-none outline-none text-[14px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)] leading-relaxed"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-input)" }}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {q.options.map((opt) => {
              const selected = currentAnswer === opt;
              return (
                <button
                  key={opt}
                  onClick={() => onSetAnswer(opt)}
                  className="w-full text-left rounded-xl px-4 py-3.5 text-[14.5px] font-medium border transition-all duration-150 flex items-center justify-between"
                  style={{
                    borderColor: selected ? accent : "var(--border-default)",
                    background: selected ? accentSoft : "var(--bg-input)",
                    color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  <span>{opt}</span>
                  <span
                    className="w-5 h-5 rounded-full border flex items-center justify-center text-[11px] shrink-0 transition-all duration-150"
                    style={{
                      borderColor: selected ? accent : "var(--border-strong)",
                      background: selected ? accent : "transparent",
                      color: "#0A0E13",
                    }}
                  >
                    {selected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigasyon — mobilde alta sabitlenen flu bar */}
      <div className="sticky-actions flex gap-3">
        <button
          onClick={onPrev}
          className="flex-1 rounded-2xl py-3.5 text-[14.5px] font-semibold border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[#141B23] transition-colors"
        >
          Geri
        </button>
        <button
          onClick={isLast ? onFinish : onNext}
          disabled={!canProceed}
          className="flex-1 rounded-2xl py-3.5 text-[14.5px] font-semibold transition-all disabled:opacity-40"
          style={{ background: canProceed ? accent : "var(--disabled-bg)", color: canProceed ? "#0A0E13" : "var(--text-faint)" }}
        >
          {isLast ? "Planı Oluştur" : "İleri"}
        </button>
      </div>
    </div>
  );
}
