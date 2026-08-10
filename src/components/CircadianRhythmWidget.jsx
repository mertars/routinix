import { useState, useEffect } from "react";
import { MONO_FONT } from "../constants";

// Sirkadiyen Ritim & Zaman Widget'ı — 3 bandı (Morning Peak/Afternoon Dip/
// Evening Flow) kullanıcının BİREBİR verdiği emoji/yüzde/etiketle taşır;
// aralarındaki/dışındaki saatler (uyanma, öğle molası, akşam toparlanması,
// gece dinlenmesi) günün geri kalanını boşluksuz kaplayan makul ara bantlarla
// (kronobiyolojideki "öğleden sonra çöküşü / ikinci dalga" eğrisiyle tutarlı)
// dolduruldu — 24 saatin TAMAMI için bir enerji rozeti olsun diye.
const ENERGY_ZONES = [
  { start: 5, end: 8, emoji: "🌅", pct: 70, label: "Isınma Evresi" },
  { start: 8, end: 12, emoji: "⚡", pct: 100, label: "Yüksek Odak" },
  { start: 12, end: 13, emoji: "🍽️", pct: 75, label: "Öğle Molası" },
  { start: 13, end: 15, emoji: "🔋", pct: 65, label: "Düşük Tempoda Görevler" },
  { start: 15, end: 18, emoji: "🌤️", pct: 80, label: "Toparlanma" },
  { start: 18, end: 22, emoji: "🔥", pct: 85, label: "İkinci Odak Dalgası" },
  { start: 22, end: 24, emoji: "🌙", pct: 40, label: "Dinlenme Zamanı" },
  { start: 0, end: 5, emoji: "🌙", pct: 40, label: "Dinlenme Zamanı" },
];
function energyForHour(hour) {
  return ENERGY_ZONES.find((z) => hour >= z.start && hour < z.end) || ENERGY_ZONES[ENERGY_ZONES.length - 1];
}

const pad = (n) => String(n).padStart(2, "0");
const WEEKDAY_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const MONTH_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// Kendi İÇİNDE saniyede bir tikleyen, TAMAMEN İZOLE bir widget (bkz.
// TaskWidgets.jsx dosya başı yorumundaki AYNI ilke: sık değişen state bir üst
// bileşene SIZMAMALI) — CategoryIntro'yu/DashboardHeader'ı saniyede bir
// yeniden render ETMEZ, yalnızca kendi DOM alt ağacını günceller.
export default function CircadianRhythmWidget() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hour = now.getHours();
  const zone = energyForHour(hour);
  const timeStr = `${pad(hour)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = `${now.getDate()} ${MONTH_TR[now.getMonth()]}, ${WEEKDAY_TR[now.getDay()]}`;

  return (
    <div
      className="glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap card-glow"
      style={{ border: "1px solid rgba(6,182,212,0.28)", boxShadow: "0 0 28px -14px rgba(6,182,212,0.55)" }}
    >
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[16px] shrink-0" style={{ background: "rgba(6,182,212,0.14)" }}>
          🕐
        </span>
        <div className="min-w-0">
          <p className="text-[15.5px] font-bold tabular-nums leading-none" style={{ color: "#06B6D4", fontFamily: MONO_FONT }}>
            {timeStr}
          </p>
          <p className="mt-1 text-[10.5px] text-[var(--text-faint)] truncate">{dateStr}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-full pl-2.5 pr-3 h-8 shrink-0" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)" }}>
        <span className="text-[14px] leading-none">{zone.emoji}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: "#10B981" }}>
          %{zone.pct}
        </span>
        <span className="text-[10.5px] font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
          {zone.label}
        </span>
      </div>
    </div>
  );
}
