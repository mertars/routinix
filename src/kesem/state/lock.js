// Uygulama kilidi yardımcıları (SAF + WebCrypto/WebAuthn). PIN ASLA düz metin saklanmaz:
// PBKDF2-SHA256 (rastgele tuz, 150.000 tur) türevi saklanır. Biyometri yalnızca cihazın
// WebAuthn platform doğrulayıcısı varsa (Face ID / Touch ID / parmak izi) sunulur.
//
// DÜRÜST SINIR: Bu bir istemci tarafı kilididir — cihazı kapalı bir tarayıcıda başkasının
// açmasına karşı korur; cihaza/tarayıcı verisine tam erişimi olan saldırgana karşı şifreleme DEĞİLDİR
// (veriler IndexedDB'de şifresiz durur).
export const PIN_MIN = 4;
export const PIN_MAX = 6;
export const PBKDF2_ITER = 150000;
export const MAX_FAILS_BEFORE_DELAY = 5;

const enc = new TextEncoder();
export const toB64 = (buf) => { const a = new Uint8Array(buf); let s = ""; for (const b of a) s += String.fromCharCode(b); return btoa(s); };
export const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const validPin = (p) => typeof p === "string" && /^\d+$/.test(p) && p.length >= PIN_MIN && p.length <= PIN_MAX;

async function derive(pin, salt, iter) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
}
export async function makePinRecord(pin, iter = PBKDF2_ITER) {
  if (!validPin(pin)) throw new Error("PIN 4–6 haneli rakam olmalı");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toB64(salt), hash: toB64(await derive(pin, salt, iter)), iter, len: pin.length };
}
// Sabit zamanlı karşılaştırma
export async function verifyPin(rec, pin) {
  if (!rec?.hash || !validPin(pin)) return false;
  const got = new Uint8Array(await derive(pin, fromB64(rec.salt), rec.iter));
  const want = fromB64(rec.hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}
// Yanlış denemeler: 5'ten sonra üstel bekleme (30 sn → 60 → 120 … en çok 15 dk)
export function nextLockoutMs(fails) {
  if (fails < MAX_FAILS_BEFORE_DELAY) return 0;
  return Math.min(15 * 60000, 30000 * 2 ** (fails - MAX_FAILS_BEFORE_DELAY));
}

// ---- Biyometri (WebAuthn, yalnızca yerel doğrulama) ----
export async function bioAvailable() {
  try {
    if (typeof PublicKeyCredential === "undefined" || !navigator.credentials) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
const challenge = () => crypto.getRandomValues(new Uint8Array(32));
export async function bioRegister(userKey) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: "Routinix Harcama Takibi" },
      user: { id: enc.encode(String(userKey).slice(0, 60) || "misafir"), name: "kesem", displayName: "Harcama Takibi" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000,
      attestation: "none",
    },
  });
  return cred ? toB64(cred.rawId) : null;
}
export async function bioAuth(credId) {
  try {
    const a = await navigator.credentials.get({
      publicKey: { challenge: challenge(), allowCredentials: [{ type: "public-key", id: fromB64(credId) }], userVerification: "required", timeout: 60000 },
    });
    return !!a;
  } catch {
    return false;
  }
}
