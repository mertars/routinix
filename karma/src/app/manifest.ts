import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Karma — Halısaha Takım Kurucu",
    short_name: "Karma",
    description: "Oyuncularını puanla, halısaha maçı için en dengeli iki takımı kur.",
    lang: "tr",
    dir: "ltr",
    start_url: "/oyuncular",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050d09",
    theme_color: "#050d09",
    categories: ["sports", "lifestyle", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Kadro Kur", short_name: "Kadro", url: "/kadro", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Oyuncular", url: "/oyuncular", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
