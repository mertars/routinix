import { X } from "lucide-react";
import { createPortal } from "react-dom";

// Onboarding turunun 5. adımındaki "Canlı Önizle" bağlantısıyla açılır.
// TEMSİLİ/ÖRNEK içerik taşır (kullanıcının henüz hiç planı olmayabilir) —
// ama sayfanın KENDİSİ, gerçek PDF çıktısının ürettiği görsel dili birebir
// yansıtır: PrintablePlan.jsx'in gerçek başlığı ("Routinix Personal
// Discipline Plan"), Georgia serif fontu, kare tik kutucukları, temiz beyaz
// zemin — hayali/farklı bir tasarım İCAT EDİLMEDİ, gerçek çıktının küçültülmüş
// bir kopyası gösterildi.
const SAMPLE_DAYS = [
  { day: 1, tasks: ["Sabah 20dk esneme rutini", "Derin çalışma bloğu — 90dk", "Akşam 5km koşu"] },
  { day: 2, tasks: ["API dokümantasyonu incele", "3×12 Squat — 60dk", "Haftalık bütçeyi gözden geçir"] },
  { day: 3, tasks: ["Kod inceleme + refactor", "Dinlenme / Serbest Gün"] },
];

export default function SamplePdfModal({ onClose }) {
  // React Portal ile document.body'ye taşınır — OnboardingTour.jsx içinde
  // (JSX'te) render edildiği için DOM'da o modalın İÇİNDE yaşardı; bu
  // durumda buradaki backdrop tıklaması, stopPropagation() ÇAĞIRMADIĞI
  // sürece DOM ağacında yukarı doğru kabarcıklanıp OnboardingTour'un KENDİ
  // backdrop'undaki onClick={finish}'i de tetikler, "Kapat" demek yerine
  // TÜM turu kapatırdı. Portal bu ata-torun ilişkisini TAMAMEN keser.
  return createPortal(
    <div className="fixed inset-0 z-[160] flex items-center justify-center px-4 py-8" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] max-h-full overflow-y-auto rounded-2xl animate-[popIn_0.25s_cubic-bezier(0.34,1.56,0.64,1)]"
        style={{ background: "rgba(var(--glass-rgb), var(--alpha-modal))", border: "1px solid var(--modal-border)", boxShadow: "0 30px 70px -20px rgba(0,0,0,0.6)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-default)" }}>
          <span className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>
            Örnek PDF Önizleme
          </span>
          <button onClick={onClose} aria-label="Kapat" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(var(--overlay-rgb),0.08)", color: "var(--text-muted)" }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 bg-white text-[#1a1a1a]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          <div className="flex items-center gap-2.5 border-b-2 pb-2.5 mb-3" style={{ borderColor: "#111" }}>
            <div className="w-8 h-8 rounded-md border-2 flex items-center justify-center font-black text-[15px] shrink-0" style={{ borderColor: "#111", fontFamily: "Arial, sans-serif" }}>
              R
            </div>
            <div>
              <div className="text-[13px] font-bold tracking-tight">Routinix Personal Discipline Plan</div>
              <div className="text-[9px] uppercase tracking-widest" style={{ color: "#555" }}>
                3 Aylık Full-Stack Gelişim Planı (Örnek)
              </div>
            </div>
          </div>

          {SAMPLE_DAYS.map((d) => (
            <div key={d.day} className="mb-3">
              <div className="text-[11px] font-bold border-b pb-1 mb-1.5" style={{ borderColor: "#ccc" }}>
                {d.day}. Gün
              </div>
              {d.tasks.map((t) => (
                <div key={t} className="flex items-start gap-1.5 my-1 text-[10px] leading-snug">
                  <span className="w-2.5 h-2.5 border-[1.5px] rounded-[2px] mt-0.5 shrink-0" style={{ borderColor: "#333" }} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          ))}

          <div className="mt-4 pt-2 border-t text-[8.5px] text-center" style={{ borderColor: "#ccc", color: "#777" }}>
            Routinix · Kişisel Disiplin Planı · Örnek Önizleme
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl py-2.5 text-[12.5px] font-bold transition-colors"
            style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
