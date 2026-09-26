// iOS "Ana ekrana ekle" açılış (splash) görselleri. Görseller
// `npm run icons` ile scripts/generate-icons.mjs tarafından üretilir.

import { withBase } from "./base-path";

export const STARTUP_SIZES = [
  // [css genişlik, css yükseklik, piksel oranı]
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 2],
  [375, 667, 2],
] as const;

export const APPLE_STARTUP_IMAGES = STARTUP_SIZES.map(([w, h, r]) => ({
  url: withBase(`/splash/splash-${w * r}x${h * r}.png`),
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
}));
