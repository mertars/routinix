import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // Yalnızca `vite build`de (dev sunucusunda DEĞİL — orada console.log hâlâ
  // hata ayıklama için gerekli) console.*/debugger ifadeleri esbuild
  // tarafından minify aşamasında tamamen elenir. Projenin kendi loglama
  // katmanı (utils/logger.js) zaten her şeyi Supabase'e de kalıcılaştırıyor
  // (bkz. services/logService.js) — console çıktısı yalnızca DX kolaylığı,
  // tek doğruluk kaynağı değil; bu yüzden production'da güvenle elenebilir.
  esbuild: command === "build" ? { drop: ["console", "debugger"] } : {},
  build: {
    rollupOptions: {
      output: {
        // Üçüncü parti kütüphaneleri kendi (sık değişmeyen) chunk'larına ayır:
        // tarayıcı bunları uygulama kodundan (sık değişir) BAĞIMSIZ önbelleğe
        // alabilir — bir sonraki deploy'da yalnızca "app" chunk'ı yeniden
        // indirilir, react/supabase/lucide-react aynı kalırsa tarayıcı önbelleği
        // hâlâ geçerlidir.
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "supabase-vendor": ["@supabase/supabase-js"],
          "icons-vendor": ["lucide-react"],
        },
      },
    },
  },
}));
