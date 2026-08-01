import { memo } from "react";
import { MONO_FONT } from "../constants";

// "Rhythm & Insights" grafik primitifleri — el yapımı SVG (yeni bağımlılık
// YOK), projenin zaten kullandığı teknikle (bkz. PomodoroStudio.jsx
// TimerRing, BackgroundScene.jsx) birebir aynı dil: stroke-dasharray/offset
// halkalar, yumuşak geçişler, neon glow yalnızca vurgulanan elemanlarda.
// Tamamı SAF/PRESENTATIONAL — veri hazırlığı utils/rhythmAnalytics.js'te.
//
// Dördü de React.memo ile sarılı: RhythmStudio.jsx'teki `data`/`buckets`/
// `pct`/`total` gibi prop'lar zaten useMemo ile (yalnızca gerçek girdi
// değişince yeniden hesaplanacak şekilde) hazırlanıyor — bu sayede tarih/
// dönem SEÇİLMEDİĞİ sürece (ör. RhythmStudio'da yalnızca "Günü Tamamla"
// yükleniyor durumu gibi alakasız bir state değiştiğinde) bu 4 SVG grafik
// HİÇ yeniden render olmaz.

// Veri henüz yoksa (focus_sessions/daily_reports boşsa) kırık/boş bir grafik
// yerine sakin, markaya uygun bir bekleme durumu — "Esnek Sistem" ruhuna
// uygun: eksiklik değil, "henüz başlıyoruz" hissi.
export function ChartEmptyState({ icon = "🌙", message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="text-[26px] opacity-70">{icon}</span>
      <p className="text-[12px] text-[var(--text-faint)] leading-relaxed max-w-[220px]">{message}</p>
    </div>
  );
}

// Ritim Dengesi & Esneklik İndeksi — TimerRing ile aynı halka tekniği,
// merkeze yüzde + kısa açıklama.
export const FlexibilityRing = memo(function FlexibilityRing({ pct, accent }) {
  const r = 62;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div className="relative w-[150px] h-[150px] flex items-center justify-center shrink-0">
      <svg viewBox="0 0 150 150" className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx="75" cy="75" r={r} fill="none" stroke="rgba(var(--overlay-rgb),0.08)" strokeWidth="10" />
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out", filter: `drop-shadow(0 0 8px ${accent})` }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-[30px] font-bold tabular-nums leading-none" style={{ fontFamily: MONO_FONT, color: "var(--text-primary)" }}>
          %{Math.round(pct)}
        </span>
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] mt-1" style={{ color: accent }}>
          Esneklik
        </span>
      </div>
    </div>
  );
});

// Derin Odak Hacmi — kategoriye göre yatay bar grafiği. data:
// [{ key, label, emoji, accent, accentSoft, minutes }] (bkz. rhythmAnalytics.js).
export const DeepWorkBars = memo(function DeepWorkBars({ data }) {
  if (!data?.length) {
    return <ChartEmptyState icon="🧠" message="Henüz kaydedilmiş bir odak seansı yok. Bir Pomodoro turunu tamamladığında burada birikmeye başlar." />;
  }
  const maxMinutes = Math.max(...data.map((d) => d.minutes), 1);
  return (
    <div className="flex flex-col gap-3 w-full">
      {data.map((d) => {
        const pct = Math.max(4, Math.round((d.minutes / maxMinutes) * 100));
        const hours = Math.floor(d.minutes / 60);
        const mins = d.minutes % 60;
        const durationLabel = hours > 0 ? `${hours} sa ${mins > 0 ? `${mins} dk` : ""}`.trim() : `${mins} dk`;
        return (
          <div key={d.key} className="flex items-center gap-3">
            <span className="w-6 text-center text-[14px] shrink-0">{d.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11.5px] font-semibold truncate" style={{ color: "var(--text-secondary)" }}>
                  {d.label}
                </span>
                <span className="text-[10.5px] font-bold tabular-nums shrink-0 ml-2" style={{ fontFamily: MONO_FONT, color: d.accent }}>
                  {durationLabel}
                </span>
              </div>
              <div className="h-[7px] rounded-full overflow-hidden" style={{ background: d.accentSoft }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%`, background: d.accent, boxShadow: `0 0 8px -1px ${d.accent}` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

// Pik Verimlilik Saatleri — 3'er saatlik 8 dilimlik yoğunluk şeridi.
// buckets: [{ startHour, endHour, minutes }] (bkz. rhythmAnalytics.js).
export const ProductivityHeatmap = memo(function ProductivityHeatmap({ buckets, accent }) {
  const hasData = (buckets || []).some((b) => b.minutes > 0);
  if (!hasData) {
    return <ChartEmptyState icon="⏱️" message="Günün hangi saatlerinde daha verimli olduğunu görmek için birkaç odak seansı gerekiyor." />;
  }
  const maxMinutes = Math.max(...buckets.map((b) => b.minutes), 1);
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${buckets.length}, 1fr)` }}>
        {buckets.map((b) => {
          const intensity = b.minutes / maxMinutes; // 0..1
          return (
            <div key={b.startHour} className="flex flex-col items-center gap-1">
              <div
                className="w-full aspect-square rounded-lg transition-all duration-500"
                style={{
                  background: intensity > 0 ? accent : "rgba(var(--overlay-rgb),0.05)",
                  opacity: intensity > 0 ? 0.25 + intensity * 0.75 : 1,
                  boxShadow: intensity > 0.6 ? `0 0 10px -2px ${accent}` : "none",
                }}
                title={`${b.startHour}:00–${b.endHour}:00 · ${b.minutes} dk`}
              />
            </div>
          );
        })}
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${buckets.length}, 1fr)` }}>
        {buckets.map((b) => (
          <span key={b.startHour} className="text-[8.5px] text-center font-medium" style={{ color: "var(--text-faint)", fontFamily: MONO_FONT }}>
            {b.startHour}
          </span>
        ))}
      </div>
    </div>
  );
});

// Zorluk/Hafifletme Dağılımı — "kaç kez Esnek Sistem devreye girdi" donut'u +
// motivasyon metni. Bilerek "başarısızlık oranı" DEĞİL, "sistemin seni
// yakaladığı gün sayısı" olarak çerçevelenir.
export const ReliefDonut = memo(function ReliefDonut({ total, reliefDays, steadyDays, accent }) {
  if (total === 0) {
    return <ChartEmptyState icon="🌿" message="Henüz bir Gün Sonu raporun yok. İlk raporunu oluşturduğunda ritim geçmişin burada görünecek." />;
  }
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const reliefPct = reliefDays / total;
  const reliefOffset = circumference * (1 - reliefPct);
  return (
    <div className="flex items-center gap-5">
      <div className="relative w-[120px] h-[120px] shrink-0">
        <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(46,217,163,0.18)" strokeWidth="14" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={reliefOffset}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-bold tabular-nums leading-none" style={{ fontFamily: MONO_FONT, color: "var(--text-primary)" }}>
            {reliefDays}
          </span>
          <span className="text-[8.5px] font-semibold uppercase tracking-[0.06em] mt-0.5" style={{ color: "var(--text-faint)" }}>
            / {total} gün
          </span>
        </div>
      </div>
      <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
        {reliefDays === 0
          ? "Bu dönemde Esnek Sistem'in devreye girmesine hiç gerek kalmadı — harika bir ritim!"
          : `Esnek Sistem bu dönemde ${reliefDays} kez devreye girdi ve yükünü hafifletti. ${steadyDays} günde ise hiç desteğe ihtiyaç duymadın — pes etmeden ritme dönmek başlı başına bir başarı. 💪`}
      </p>
    </div>
  );
});
