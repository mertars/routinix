// PWA ikonlarını ve iOS açılış (splash) görsellerini SVG'den üretir.
// Kullanım: npm run icons   (çıktılar public/icons ve public/splash altına yazılır)

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// src/lib/pwa.ts içindeki STARTUP_SIZES ile aynı tutulmalı.
const STARTUP_SIZES = [
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 2],
  [375, 667, 2],
];

/** 64x64 koordinatlı logo işareti (components/logo.tsx ile aynı çizim). */
function mark(x, y, size) {
  const s = size / 64;
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M30 6a26 26 0 0 0 0 52z" fill="url(#neon)"/>
    <path d="M34 6a26 26 0 0 1 0 52z" fill="#e8f3ec"/>
    <path d="M22 22l6 4-2 7h-7l-2-6z" fill="#03140a" opacity=".85"/>
    <path d="M42 31l6-3 4 5-3 6-6-1z" fill="#03140a" opacity=".75"/>
  </g>`;
}

const defs = `
  <defs>
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6bffaa"/>
      <stop offset="1" stop-color="#19b862"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#3ef08a" stop-opacity=".16"/>
      <stop offset="1" stop-color="#3ef08a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bg" cx="50%" cy="30%" r="80%">
      <stop offset="0" stop-color="#123522"/>
      <stop offset="1" stop-color="#050d09"/>
    </radialGradient>
  </defs>`;

/** Kare ikon. `radius` 0 ise tam dolu (maskable / apple). `scale` logonun kenara oranı. */
function iconSvg(size, { radius = 0, scale = 0.62 } = {}) {
  const logo = size * scale;
  const off = (size - logo) / 2;
  const lineW = size * 0.012;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${defs}
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.43}" fill="none" stroke="#3ef08a" stroke-opacity=".14" stroke-width="${lineW}"/>
  ${mark(off, off, logo)}
</svg>`;
}

function splashSvg(w, h) {
  const logo = Math.round(w * 0.3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${defs}
  <rect width="${w}" height="${h}" fill="#050d09"/>
  <circle cx="${w / 2}" cy="${h * 0.46}" r="${w * 0.75}" fill="url(#glow)"/>
  <circle cx="${w / 2}" cy="${h * 0.46}" r="${w * 0.28}" fill="none" stroke="#3ef08a" stroke-opacity=".12" stroke-width="${w * 0.006}"/>
  ${mark((w - logo) / 2, h * 0.46 - logo / 2, logo)}
</svg>`;
}

async function png(svg, file) {
  await mkdir(dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
  console.log("✓", file.replace(root, "public"));
}

await png(iconSvg(192, { radius: 42 }), join(root, "icons/icon-192.png"));
await png(iconSvg(512, { radius: 112 }), join(root, "icons/icon-512.png"));
await png(iconSvg(512, { scale: 0.5 }), join(root, "icons/maskable-512.png"));
await png(iconSvg(180, { scale: 0.6 }), join(root, "icons/apple-touch-icon.png"));
await writeFile(join(root, "icons/favicon.svg"), iconSvg(64, { radius: 14, scale: 0.78 }));
console.log("✓ public/icons/favicon.svg");

for (const [w, h, r] of STARTUP_SIZES) {
  await png(splashSvg(w * r, h * r), join(root, `splash/splash-${w * r}x${h * r}.png`));
}
