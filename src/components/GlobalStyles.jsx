// Paylaşılan keyframe animasyonları ve birkaç yardımcı sınıf (drawer/bottom-sheet
// giriş animasyonları, scrollbar gizleme). Tüm ekranlarda ortak olduğu için App
// kökünde bir kez render edilir.
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
      .drawer-panel {
        animation: slideInDrawer 0.25s ease;
      }
      .focus-sheet {
        animation: slideUpSheet 0.28s cubic-bezier(0.32, 0.72, 0, 1);
      }
      .no-scrollbar {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .motion-safe\\:animate-spin { animation: none !important; }
        .drawer-panel { animation: none !important; }
        .focus-sheet { animation: none !important; }
      }
    `}</style>
  );
}
