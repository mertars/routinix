// Karma iki şekilde yayınlanabilir:
//  - bağımsız (Vercel, Root Directory: karma) → kök "/"
//  - Routinix'in içinde statik olarak → "/karma" (bkz. scripts/build-routinix.mjs)
// Next, Link ve router için basePath'i kendisi ekler; bu yardımcılar yalnızca
// elle yazılan mutlak adresler (manifest, ikonlar, service worker, paylaşım
// linki) içindir.

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Routinix içinde mi çalışıyoruz? (Routinix'e dönüş bağlantısını göstermek için) */
export const EMBEDDED_IN_ROUTINIX = process.env.NEXT_PUBLIC_HOST_APP === "routinix";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
