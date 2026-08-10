import { useState, useEffect } from "react";

// Saat Duyarlı Dinamik Ana Ekran Mimarisi — CategoryIntro.jsx'in giriş
// ekranındaki eskiden SABİT "Hedefini tanımla, disiplinini yapılandıralım."
// başlığının YERİNE geçer; günün saatine göre 4 bandın biri gösterilir.
// 5 dakikada bir yeniden hesaplanır (saniyede bir tikleyen bir saat DEĞİL —
// yalnızca bant sınırını geçtiğinde metnin bayatlamaması yeterli).
const GREETING_BANDS = [
  { start: 5, end: 12, title: "Günaydın. Odak gücün en yüksek seviyede.", subtitle: "Erken saatlerin sessizliğini derin çalışma bloğuna dönüştür." },
  { start: 12, end: 18, title: "Tünaydın. Günün ikinci yarısı başladı.", subtitle: "Ritimden kopma, gün içi hedeflerini tamamla." },
  { start: 18, end: 23, title: "İyi akşamlar. Günün çıktılarını değerlendirelim.", subtitle: "Kapanış seansları ve gece analizleri için hazırız." },
];
const NIGHT_BAND = { title: "Gece Oturumu. Sessizlikte derin odak.", subtitle: "Zihnini yormadan son odak bloğunu tamamla." };

function greetingForHour(hour) {
  // 23:00 - 04:59 gece yarısını sarıyor, GREETING_BANDS'in [start,end)
  // deseniyle ifade edilemez — ayrı ele alınır.
  if (hour >= 23 || hour < 5) return NIGHT_BAND;
  return GREETING_BANDS.find((b) => hour >= b.start && hour < b.end) || GREETING_BANDS[0];
}

export default function DashboardHeader() {
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const { title, subtitle } = greetingForHour(hour);

  return (
    <div>
      <h1 className="text-2xl md:text-5xl font-bold leading-[1.12] tracking-tight text-balance">
        <span
          style={{
            background: "var(--hero-gradient)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {title}
        </span>
      </h1>
      <p className="mt-2 md:mt-3 text-sm md:text-lg text-[var(--text-muted)] leading-relaxed md:max-w-2xl">{subtitle}</p>
    </div>
  );
}
