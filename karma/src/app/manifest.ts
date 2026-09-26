import type { MetadataRoute } from "next";
import { withBase } from "@/lib/base-path";

// Statik dışa aktarımda da dosya olarak üretilsin.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: withBase("/"),
    name: "Karma — Halısaha Takım Kurucu",
    short_name: "Karma",
    description: "Oyuncularını puanla, halısaha maçı için en dengeli iki takımı kur.",
    lang: "tr",
    dir: "ltr",
    start_url: withBase("/oyuncular"),
    scope: withBase("/"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#050d09",
    theme_color: "#050d09",
    categories: ["sports", "lifestyle", "utilities"],
    icons: [
      { src: withBase("/icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBase("/icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: withBase("/icons/maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Kadro Kur", short_name: "Kadro", url: withBase("/kadro"), icons: [{ src: withBase("/icons/icon-192.png"), sizes: "192x192" }] },
      { name: "Oyuncular", url: withBase("/oyuncular"), icons: [{ src: withBase("/icons/icon-192.png"), sizes: "192x192" }] },
    ],
  };
}
