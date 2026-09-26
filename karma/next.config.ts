import path from "node:path";
import type { NextConfig } from "next";

// KARMA_TARGET=routinix → Routinix'in içine gömülecek statik çıktı (/karma altında).
// Aksi halde bağımsız Next.js uygulaması (Vercel Root Directory: karma).
const forRoutinix = process.env.KARMA_TARGET === "routinix";
const basePath = forRoutinix ? "/karma" : "";

const nextConfig: NextConfig = {
  // Proje, Routinix reposunun içinde bağımsız bir klasör. Kökteki
  // package-lock.json yüzünden Next'in çalışma alanı kökünü yanlış tahmin
  // etmemesi için kökü açıkça bu klasöre sabitliyoruz.
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
  reactStrictMode: true,
  poweredByHeader: false,
  // `next dev`'in projeye AGENTS.md / CLAUDE.md yazmasını kapat.
  agentRules: false,
  // Geliştirme göstergesi alt menünün üstüne biniyor; hata ekranı yine çalışır.
  devIndicators: false,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_HOST_APP: forRoutinix ? "routinix" : "",
  },
  ...(forRoutinix
    ? {
        // Statik dışa aktarımda yönlendirme ve başlıkları Routinix'in
        // vercel.json'ı karşılar.
        output: "export" as const,
        basePath,
      }
    : {
        async redirects() {
          return [{ source: "/", destination: "/oyuncular", permanent: false }];
        },
        async headers() {
          return [
            {
              source: "/sw.js",
              headers: [
                { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                { key: "Service-Worker-Allowed", value: "/" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
