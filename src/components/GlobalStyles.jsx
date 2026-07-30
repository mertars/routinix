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
      @keyframes slideInDrawerLeft {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }
      @keyframes slideUpSheet {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      @keyframes slideDownSheet {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(100%); opacity: 0.4; }
      }
      @keyframes modalPopIn {
        from { opacity: 0; transform: scale(0.96) translateY(8px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes modalPopOut {
        from { opacity: 1; transform: scale(1) translateY(0); }
        to { opacity: 0; transform: scale(0.96) translateY(8px); }
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
      .drawer-panel-left { animation: slideInDrawerLeft 0.28s cubic-bezier(0.32, 0.72, 0, 1); }
      .focus-sheet { animation: slideUpSheet 0.28s cubic-bezier(0.32, 0.72, 0, 1); }
      .day-reveal { animation: dayReveal 0.3s cubic-bezier(0.32, 0.72, 0, 1); }

      .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
      .no-scrollbar::-webkit-scrollbar { display: none; }

      /* --- İnce, transparan-beyaz scrollbar (Pomodoro Studio görev paneli).
         Projede bir Tailwind scrollbar eklentisi (tailwind-scrollbar vb.) KURULU
         DEĞİL — "scrollbar-thin scrollbar-thumb-white/10" gibi sınıflar bu
         projede hiçbir şey yapmaz. Onun yerine gerçek çalışan bir CSS
         karşılığı: --- */
      .thin-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.14) transparent; }
      .thin-scrollbar::-webkit-scrollbar { width: 6px; }
      .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .thin-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 9999px; }
      .thin-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }

      /* Not: "Bugünün Görevleri" (TodayPopover) ve Pomodoro Studio'nun sol
         Görev/Plan paneli (TaskListPanel) artık .custom-neon-scroll'u
         kullanıyor — bkz. src/index.css (fonksiyonel overflow/touch
         özellikleriyle birlikte TEK bir yerde, yüksek öncelikli tanım). */

      /* --- Mor/kırmızı neon aura şeridi (header altı, vurgu çizgileri) --- */
      .neon-strip {
        height: 2px;
        background: linear-gradient(90deg, transparent 0%, #B26BFF 30%, #F4406B 70%, transparent 100%);
        box-shadow: 0 0 12px 1px rgba(178,107,255,0.45), 0 0 20px 2px rgba(244,64,107,0.30);
        animation: auraPulse 4s ease-in-out infinite;
      }

      /* --- Glassmorphism kart --- */
      /* Koyu temada ince, düşük-alfa "luminance" ayrımı; açık temada aynı teknik
         neredeyse görünmez kaldığından belirgin gri bir kenarlığa (border-slate-200
         eşleniği) geçilir — bkz. :root[data-theme="light"] --glass-border. */
      .glass {
        background: rgba(var(--glass-rgb), var(--alpha-card));
        backdrop-filter: blur(16px) saturate(150%);
        -webkit-backdrop-filter: blur(16px) saturate(150%);
        border: 1px solid var(--glass-border);
        box-shadow: var(--glass-shadow);
      }

      /* --- Modal/Popover/Drawer katmanı: en yüksek okunabilirlik (bkz. --alpha-modal) --- */
      .glass-modal {
        background: rgba(var(--glass-rgb), var(--alpha-modal));
        border: 1px solid var(--modal-border);
      }

      /* --- 4'lü odak kartları (Yazılım/Fitness/Seyahat/Öğrenme): koyu temada
         .glass ile aynı, açık temada bembeyaz + belirgin gölge/kenarlık ile
         mat zeminden öne çıkar. --- */
      .category-card {
        background: var(--category-card-bg);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--category-card-border);
        box-shadow: var(--category-card-shadow);
      }

      /* --- Header/Sidebar katmanı: en saydam, ambient (bkz. --alpha-chrome) --- */
      .glass-chrome {
        background: rgba(var(--glass-rgb), var(--alpha-chrome));
      }

      /* --- Mobil dokunma gecikmesini sıfırla: tarayıcının "çift dokununca
         yakınlaştır" için beklediği ~300ms algılama gecikmesi devre dışı
         kalır (manipulation = kaydırma/pinch-zoom serbest, yalnızca çift-tap
         zoom kapalı). -webkit-tap-highlight-color de tarayıcının varsayılan
         gri/mavi dokunma flaşını kaldırır — bu efekt zaten bizim kendi
         :active tasarımımızla (aşağıdaki mikro-çökme + card-glow) çakışıp
         görsel gürültü yaratıyordu; kaldırılması TASARIMI DEĞİL, tarayıcının
         bizim tasarımımızın üzerine bindirdiği varsayılan katmanı kaldırır. */
      button, .card-glow, input, textarea, select {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }

      /* --- Dokunsal (tactile) mikro-çökme: tüm butonlar basılınca hafifçe içe çöker --- */
      button { transition: transform 0.09s ease; }
      button:not(:disabled):active { transform: scale(0.97); }

      /* --- Takvim şeridi kenar solması (mask-gradient) --- */
      .edge-fade-x {
        -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%);
        mask-image: linear-gradient(90deg, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%);
      }

      /* --- Kilitli gün: buzlu cam katmanı (koyu: yarı saydam koyu; açık:
         bg-slate-200/60 + border-slate-300 eşleniği) --- */
      .frost-lock {
        background: rgba(var(--lock-rgb), 0.6);
        backdrop-filter: blur(6px) saturate(120%);
        -webkit-backdrop-filter: blur(6px) saturate(120%);
        border: 1px solid var(--lock-border);
      }

      /* --- Input odaklanınca yanlardan taşan neon ışıltı --- */
      .input-glow { position: relative; transition: box-shadow 0.25s ease, border-color 0.25s ease; }
      .input-glow:focus-within {
        border-color: rgba(178,107,255,0.55) !important;
        box-shadow: -6px 0 18px -6px rgba(178,107,255,0.55), 6px 0 18px -6px rgba(244,64,107,0.5),
                    0 0 0 1px rgba(178,107,255,0.25);
      }

      /* --- AI Koç "yazıyor..." noktaları --- */
      @keyframes typingBounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
        30% { transform: translateY(-3px); opacity: 1; }
      }
      .typing-dot { animation: typingBounce 1.1s ease-in-out infinite; }
      .typing-dot:nth-child(2) { animation-delay: 0.15s; }
      .typing-dot:nth-child(3) { animation-delay: 0.3s; }

      /* --- Duyarlı panel (FocusSidePanel.jsx): mobilde alttan açılan "Bottom
         Sheet", md'den itibaren sol/sağ kenardan açılan yan "Drawer/Sidebar"a
         dönüşür. Görev kartı detayları (TaskCard → "Mikro-Arayüz" açılımı) bu
         primitifi kullanır. --- */
      .focus-panel {
        position: fixed;
        z-index: 95;
        display: flex;
        flex-direction: column;
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 1.5rem 1.5rem 0 0;
        max-height: 75vh;
        animation: slideUpSheet 0.28s cubic-bezier(0.32, 0.72, 0, 1);
      }
      @media (min-width: 768px) {
        .focus-panel {
          left: auto;
          right: auto;
          top: 0;
          bottom: 0;
          height: 100%;
          max-height: none;
          width: 340px;
          border-radius: 0;
        }
        .focus-panel--right {
          right: 0;
          animation: slideInDrawer 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }
        .focus-panel--left {
          left: 0;
          animation: slideInDrawerLeft 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }
      }

      /* --- Pomodoro Studio: yüzen alt sekme çubuğu (mobil, md'den itibaren
         gizli — masaüstünde sabit 2 sütun düzeni kullanılıyor, sekmeye gerek
         yok). Odak Modu'na girildiğinde (sayaç çalışırken ya da Işıklar
         Söndü'ndeyken) yukarı kayıp soluklaşarak kaybolur. --- */
      .pomo-tabbar {
        animation: slideUpSheet 0.32s cubic-bezier(0.32, 0.72, 0, 1);
      }

      /* --- Karta tıklayınca (aktif) hafif neon glow ---
         "transition: all" KULLANILMIYOR — yalnızca box-shadow + transform (ucuz,
         compositor'da çalışan özellikler). translateZ(0) + will-change,
         tarayıcıya kartı kendi GPU katmanına alması için erken sinyal verir;
         böylece :active'deki scale dönüşümü ana thread'i tıkamaz — mobilde
         tik atma/kart seçme anındaki FPS düşüşünün CSS tarafındaki düzeltmesi. */
      .card-glow {
        transition: box-shadow 0.2s ease, transform 0.12s ease;
        transform: translateZ(0);
        will-change: transform, opacity;
        /* "layout style" (paint HARİÇ): tıklama/hover'da bu kartın iç
           yeniden-ölçümü sayfanın geri kalanına sıçramaz, tarayıcı re-layout'u
           bu sınırın dışına taşmaz. Kasıtlı olarak "paint"/"strict" KULLANILMADI
           çünkü :active durumundaki box-shadow (glow) kutu sınırının dışına
           taşıyor — paint containment bunu kırpar ve görseli değiştirirdi. */
        contain: layout style;
      }
      .card-glow:active {
        transform: translateZ(0) scale(0.985);
        box-shadow: 0 0 0 1px rgba(178,107,255,0.4), 0 8px 26px -8px rgba(244,64,107,0.45);
      }

      /* --- Günün görev grid'i: kendi iç layout'unu (kartlar sarma/yükseklik
         değişimi) sayfanın geri kalanından (takvim şeridi, başlık) izole eder —
         yalnızca reflow kapsamını daraltır, hiçbir görsel etkisi yoktur. --- */
      /* NOT: contain:layout BİLEREK YOK — bu konteynerin içinde (TaskCard'ın
         Fragment kardeşi olarak) position:fixed bir FocusSidePanel render
         edildiğinde, contain:layout onu viewport yerine BU konteynerin
         sınırlayıcı kutusuna hapsediyordu (sağ-alt köşede küçük, konumu
         bozuk bir "popup" gibi görünmesinin kök nedeni buydu). */
      .task-grid { contain: style; }

      /* --- Ekran dışı görev kartları/satırları: content-visibility:auto,
         viewport'a girmemiş elemanların layout+paint maliyetini tamamen
         atlar (DOM'dan silmez, yalnızca "henüz çizme" der). contain-intrinsic-size
         "auto <yükseklik>" formu KRİTİK: "auto" tarayıcıya, eleman bir kez
         gerçekten çizildikten sonra GERÇEK yüksekliğini hatırlamasını söyler;
         yalnızca hiç görülmemiş ilk durumda <yükseklik> tahmini kullanılır.
         Bu sayede scroll sırasında yanlış tahminden kaynaklanan bir sıçrama/
         zıplama OLMAZ — görsel %100 aynı kalır, yalnızca ekran dışındaki
         işlemci maliyeti sıfırlanır. */
      .task-card { content-visibility: auto; contain-intrinsic-size: auto 160px; }
      .task-row { content-visibility: auto; contain-intrinsic-size: auto 44px; }

      /* --- Mobilde ağır backdrop-blur/saturate maliyetini azalt: aynı katman
         hiyerarşisi (chrome < card < modal) korunur, yalnızca piksel maliyeti
         düşer. Masaüstünde (≥768px) tam efekt aynen kalır. --- */
      @media (max-width: 767px) {
        .glass { backdrop-filter: blur(8px) saturate(130%); -webkit-backdrop-filter: blur(8px) saturate(130%); }
        .category-card { backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
        .frost-lock { backdrop-filter: blur(4px) saturate(110%); -webkit-backdrop-filter: blur(4px) saturate(110%); }
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
        background: rgba(var(--glass-rgb), var(--alpha-chrome));
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-top: 1px solid var(--border-header);
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

      /* --- Yavaşça süzülen bulanık glow blob'lar (BackgroundScene) — hem koyu
         hem açık temada mevcut, opaklık (--blob-opacity) temaya göre ayarlanır.
         Renk artık SABİT değil: aktif planın/kategori seçiminin türüne göre
         değişir (bkz. BackgroundScene.jsx GLOW_BY_CATEGORY). Rengi bir CSS
         custom property'de (--glow-violet/--glow-orange) tutup @property ile
         renk tipinde tanımlıyoruz — bu, "transition" ile YUMUŞAK bir renk
         geçişi almanın tek CSS-only yolu (düz "background" gradient'ini
         browser'lar interpolate ETMEZ). Yalnızca renk (compositor-dışı ama
         çok ucuz bir paint) değişir; transform/opacity animasyonlarına
         DOKUNULMAZ, performansı etkilemez. */
      @property --glow-violet {
        syntax: '<color>';
        inherits: true;
        initial-value: #B26BFF;
      }
      @property --glow-orange {
        syntax: '<color>';
        inherits: true;
        initial-value: #C2410C;
      }
      @keyframes blobFloatA {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(4%, 6%) scale(1.08); }
        66% { transform: translate(-3%, 3%) scale(0.96); }
      }
      @keyframes blobFloatB {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(-5%, -4%) scale(1.1); }
      }
      .bg-blob {
        position: absolute;
        border-radius: 9999px;
        filter: blur(70px);
        opacity: var(--blob-opacity);
        will-change: transform;
      }
      .bg-blob--violet {
        background: radial-gradient(circle, var(--glow-violet) 0%, transparent 70%);
        transition: --glow-violet 0.8s ease;
        animation: blobFloatA 26s ease-in-out infinite;
      }
      .bg-blob--orange {
        background: radial-gradient(circle, var(--glow-orange) 0%, transparent 70%);
        transition: --glow-orange 0.8s ease;
        animation: blobFloatB 32s ease-in-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .motion-safe\\:animate-spin { animation: none !important; }
        .drawer-panel, .drawer-panel-left, .focus-sheet, .focus-panel, .pomo-tabbar, .day-reveal, .neon-strip, .pop-in, .chip-fill-pulse, .check-glow { animation: none !important; }
        .bg-blob--violet, .bg-blob--orange { animation: none !important; }
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
