/** @type {import('tailwindcss').Config} */
// Not: Bu proje Tailwind v4 + @tailwindcss/vite (CSS-first config) kullanıyor.
// Gerçek dark-mode anahtarı src/index.css'teki
// `@custom-variant dark (&:where(.dark, .dark *));` satırıdır — bu dosya
// `@config` ile yüklenmiyor (v4'te opsiyonel), yalnızca niyeti belgelemek ve
// editör/araç desteği (IntelliSense vb.) için tutulur; darkMode değeri
// index.css'teki custom-variant ile birebir aynı stratejiyi (class tabanlı,
// .dark) yansıtır.
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
};
