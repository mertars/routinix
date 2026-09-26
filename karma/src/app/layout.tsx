import type { Metadata, Viewport } from "next";
import "./fonts.css";
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-ext-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-ext-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-ext-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/barlow-condensed/latin-ext-800.css";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { withBase } from "@/lib/base-path";
import { APPLE_STARTUP_IMAGES } from "@/lib/pwa";

export const metadata: Metadata = {
  title: { default: "Karma — Halısaha Takım Kurucu", template: "%s · Karma" },
  description: "Oyuncularını puanla, halısaha maçı için en dengeli iki takımı saniyeler içinde kur.",
  applicationName: "Karma",
  manifest: withBase("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    title: "Karma",
    statusBarStyle: "black-translucent",
    startupImage: APPLE_STARTUP_IMAGES,
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: withBase("/icons/favicon.svg"), type: "image/svg+xml" },
      { url: withBase("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: withBase("/icons/apple-touch-icon.png"), sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#050d09",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
