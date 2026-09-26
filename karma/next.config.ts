import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proje, Routinix reposunun içinde bağımsız bir klasör. Kökteki
  // package-lock.json yüzünden Next'in çalışma alanı kökünü yanlış tahmin
  // etmemesi için kökü açıkça bu klasöre sabitliyoruz.
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
  reactStrictMode: true,
  // `next dev`'in projeye AGENTS.md / CLAUDE.md yazmasını kapat.
  agentRules: false,
  poweredByHeader: false,
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
};

export default nextConfig;
