// Karma'yı Routinix'in içine gömülecek şekilde statik olarak derler ve
// çıktıyı Routinix'in public/karma klasörüne kopyalar. Routinix'in kendi
// build'i (vite) public/ klasörünü olduğu gibi dist/'e taşır; böylece Karma
// Routinix'in derleme sürecine hiç dokunmadan /karma adresinde yayına çıkar.
//
// Kullanım (karma klasöründe):  npm run build:routinix
// Karma'da değişiklik yaptıktan sonra bu komutu çalıştırıp public/karma'yı
// commit'lemek yeterli.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const karmaDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(karmaDir, "out");
const target = join(karmaDir, "..", "public", "karma");

rmSync(outDir, { recursive: true, force: true });
const build = spawnSync("npx", ["next", "build"], {
  cwd: karmaDir,
  stdio: "inherit",
  env: { ...process.env, KARMA_TARGET: "routinix" },
  shell: process.platform === "win32",
});
if (build.status !== 0) process.exit(build.status ?? 1);
if (!existsSync(join(outDir, "oyuncular.html"))) {
  console.error("Beklenen statik çıktı bulunamadı (out/oyuncular.html).");
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(outDir, target, { recursive: true });
rmSync(outDir, { recursive: true, force: true });
console.log(`\n✓ Karma, Routinix içine kopyalandı: ${target}`);
