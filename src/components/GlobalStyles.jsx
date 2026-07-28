// Paylaşılan animasyonlar + Routinix "Dark Glassmorphism / mor-kırmızı neon aura"
// yardımcı sınıfları. App kökünde bir kez render edilir.
export default function GlobalStyles() {
  return (
    <style>{`
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(12px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes slideInDrawer {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      @keyframes slideUpSheet {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      @keyframes auraPulse {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 1; }
      }
      @keyframes dayReveal {
        from { opacity: 0; transform: translateY(10px) scale(0.99); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .drawer-panel { animation: slideInDrawer 0.28s cubic-bezier(0.32, 0.72, 0, 1); }
      .focus-sheet { animation: slideUpSheet 0.28s cubic-bezier(0.32, 0.72, 0, 1); }
      .day-reveal { animation: dayReveal 0.3s cubic-bezier(0.32, 0.72, 0, 1); }

      .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
      .no-scrollbar::-webkit-scrollbar { display: none; }

      /* --- Mor/kırmızı neon aura şeridi (header altı, vurgu çizgileri) --- */
      .neon-strip {
        height: 2px;
        background: linear-gradient(90deg, transparent 0%, #B26BFF 30%, #F4406B 70%, transparent 100%);
        box-shadow: 0 0 12px 1px rgba(178,107,255,0.45), 0 0 20px 2px rgba(244,64,107,0.30);
        animation: auraPulse 4s ease-in-out infinite;
      }

      /* --- Glassmorphism kart --- */
      .glass {
        background: rgba(18, 24, 31, 0.70);
        backdrop-filter: blur(16px) saturate(150%);
        -webkit-backdrop-filter: blur(16px) saturate(150%);
        border: 1px solid rgba(255,255,255,0.06);
      }

      /* --- Dokunsal (tactile) mikro-çökme: tüm butonlar basılınca hafifçe içe çöker --- */
      button { transition: transform 0.09s ease; }
      button:not(:disabled):active { transform: scale(0.97); }

      /* --- Takvim şeridi kenar solması (mask-gradient) --- */
      .edge-fade-x {
        -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%);
        mask-image: linear-gradient(90deg, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%);
      }

      /* --- Kilitli gün: buzlu cam katmanı --- */
      .frost-lock {
        background: rgba(20, 24, 32, 0.55);
        backdrop-filter: blur(6px) saturate(120%);
        -webkit-backdrop-filter: blur(6px) saturate(120%);
        border: 1px solid rgba(255,255,255,0.06);
      }

      /* --- Input odaklanınca yanlardan taşan neon ışıltı --- */
      .input-glow { position: relative; transition: box-shadow 0.25s ease, border-color 0.25s ease; }
      .input-glow:focus-within {
        border-color: rgba(178,107,255,0.55) !important;
        box-shadow: -6px 0 18px -6px rgba(178,107,255,0.55), 6px 0 18px -6px rgba(244,64,107,0.5),
                    0 0 0 1px rgba(178,107,255,0.25);
      }

      /* --- Karta tıklayınca (aktif) hafif neon glow --- */
      .card-glow { transition: box-shadow 0.2s ease, transform 0.12s ease; }
      .card-glow:active {
        transform: scale(0.985);
        box-shadow: 0 0 0 1px rgba(178,107,255,0.4), 0 8px 26px -8px rgba(244,64,107,0.45);
      }

      /* --- Accordion (grid-rows tekniği ile yumuşak aç/kapa) --- */
      .accordion-body {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows 0.32s cubic-bezier(0.32, 0.72, 0, 1);
      }
      .accordion-body.open { grid-template-rows: 1fr; }
      .accordion-body > .accordion-inner { overflow: hidden; min-height: 0; }
      .accordion-chevron { transition: transform 0.28s ease; }
      .accordion-chevron.open { transform: rotate(180deg); }

      /* --- Mobil sticky alt aksiyon barı (flu arka planlı) --- */
      .sticky-actions {
        position: sticky;
        bottom: 0;
        z-index: 20;
        margin-left: -20px;
        margin-right: -20px;
        padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));
        background: rgba(10, 14, 19, 0.82);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-top: 1px solid #1E2731;
      }

      /* --- Popover (Bugünün Görevleri) açılış animasyonu --- */
      @keyframes popIn {
        from { opacity: 0; transform: translateY(-8px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .pop-in { animation: popIn 0.18s cubic-bezier(0.32, 0.72, 0, 1); transform-origin: top right; }

      /* --- Rutin tiklenince yeşil/mor neon parıltı --- */
      @keyframes checkGlow {
        0% { box-shadow: 0 0 0 0 rgba(46,217,163,0); }
        45% { box-shadow: 0 0 16px 2px rgba(46,217,163,0.6), 0 0 12px 1px rgba(178,107,255,0.5); }
        100% { box-shadow: 0 0 0 0 rgba(46,217,163,0); }
      }
      .check-glow { animation: checkGlow 0.6s ease-out; }

      /* --- Şablon çipiyle input dolunca mikro parıltı --- */
      @keyframes chipFill {
        0% { box-shadow: 0 0 0 1px rgba(178,107,255,0.0); }
        30% { box-shadow: -8px 0 22px -6px rgba(178,107,255,0.7), 8px 0 22px -6px rgba(244,64,107,0.6), 0 0 0 1px rgba(178,107,255,0.5); }
        100% { box-shadow: 0 0 0 1px rgba(178,107,255,0.0); }
      }
      .chip-fill-pulse { animation: chipFill 0.6s ease-out; }

      @media (prefers-reduced-motion: reduce) {
        .motion-safe\\:animate-spin { animation: none !important; }
        .drawer-panel, .focus-sheet, .day-reveal, .neon-strip, .pop-in, .chip-fill-pulse, .check-glow { animation: none !important; }
        .accordion-body { transition: none !important; }
      }

      /* ================= YAZDIRMA / PDF ================= */
      /* Ekranda gizli; sadece baskıda görünür. print-root #root içinde olduğu
         için display:none ile gizlemek yerine visibility ile sadece onu gösteririz. */
      .print-root { display: none; }
      @media print {
        #root { visibility: hidden; }
        .print-root {
          display: block !important;
          visibility: visible;
          position: absolute;
          top: 0; left: 0; width: 100%;
          background: #ffffff !important;
          color: #1a1a1a !important;
          padding: 0;
          font-family: Georgia, "Times New Roman", serif;
        }
        @page { margin: 18mm 16mm; }
        .print-root * { visibility: visible; color: #1a1a1a !important; background: transparent !important; box-shadow: none !important; }
        .print-header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
        .print-logo {
          width: 40px; height: 40px; border-radius: 9px; border: 2px solid #111;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 22px; font-family: Arial, sans-serif;
        }
        .print-title { font-size: 20px; font-weight: 700; letter-spacing: 0.3px; }
        .print-subtitle { font-size: 11px; color: #555 !important; letter-spacing: 1px; text-transform: uppercase; }
        .print-day { margin-bottom: 16px; break-inside: avoid; }
        .print-day-title { font-size: 14px; font-weight: 700; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }
        .print-task { display: flex; align-items: flex-start; gap: 8px; margin: 5px 0; font-size: 12.5px; }
        .print-check { width: 13px; height: 13px; border: 1.5px solid #333; border-radius: 3px; margin-top: 2px; flex-shrink: 0; }
        .print-task-detail { font-size: 11px; color: #666 !important; }
        .print-routines { margin-bottom: 18px; }
        .print-footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 10px; color: #777 !important; text-align: center; }
      }
    `}</style>
  );
}
