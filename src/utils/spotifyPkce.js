// Spotify OAuth 2.0 — Authorization Code + PKCE akışı. PKCE, bir "client
// secret" GEREKTİRMEZ (bu yüzden tamamen istemci tarafında, Vercel'de
// SUNUCU olmadan çalışabilir) — bunun yerine her giriş denemesinde rastgele
// bir "code_verifier" üretilir, SHA-256 hash'i ("code_challenge") Spotify'a
// yetkilendirme isteğiyle gönderilir; token değişiminde ORİJİNAL verifier
// tekrar sunulup Spotify'ın az önce aldığı challenge'la eşleştiği doğrulanır
// — böylece kodu araya giren biri yakalasa bile verifier olmadan token'a
// çeviremez. Referans: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
//
// DÜRÜSTLÜK NOTU: bu dosya Spotify'ın PUBLIC olarak belgelenmiş OAuth/PKCE
// sözleşmesine göre yazıldı ancak bu ortamda GERÇEK bir Spotify Client ID'yle
// uçtan uca (tarayıcıda gerçek bir kullanıcı onayı vererek) TEST EDİLEMEDİ —
// canlıya almadan önce gerçek bir Spotify Developer App ile bir kez elle
// doğrulanması ÖNERİLİR (bkz. .env.example'daki kurulum notları).
const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

// Kullanıcının profil bilgisi (user-read-private), kendi çalma listeleri
// (playlist-read-private) ve İLERİDE tam bir Web Playback SDK entegrasyonu
// (streaming/user-modify-playback-state/user-read-currently-playing) için
// gereken kapsamlar. NOT: streaming/user-modify-playback-state şu an İÇİN
// yalnızca İZİN OLARAK istenir — bu turda gerçek bir Web Playback SDK
// cihazı (Premium hesap gerektiren, çok daha büyük bir entegrasyon) KURULMADI;
// kişisel çalma listeleri bunun yerine mevcut Spotify Embed'ine yüklenir
// (bkz. MusicContext.jsx dosya başı yorumu).
const SCOPES = ["user-read-private", "playlist-read-private", "streaming", "user-modify-playback-state", "user-read-currently-playing"].join(" ");

const TOKEN_STORAGE_KEY = "routinix_spotify_tokens"; // {accessToken, refreshToken, expiresAt}
const VERIFIER_STORAGE_KEY = "routinix_spotify_pkce_verifier";
const STATE_STORAGE_KEY = "routinix_spotify_pkce_state";

function base64UrlEncode(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomUrlSafeString(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64UrlEncode(bytes);
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return new Uint8Array(digest);
}

function getClientId() {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  if (!clientId) {
    throw new Error("Spotify bağlantısı yapılandırılmamış — VITE_SPOTIFY_CLIENT_ID tanımlı değil (bkz. .env.example).");
  }
  return clientId;
}

// Spotify'a EKSİKSİZ AYNI şekilde geri gönderilmesi/kayıtlı olması gereken
// adres — Dashboard'daki Redirect URI listesiyle TAM eşleşmeli (bkz.
// .env.example). Sondaki "/" bilerek sabit: window.location.pathname'in o
// anki alt sayfaya göre değişmesi Spotify'da "her olası path" için ayrı
// kayıt gerektirirdi; bunun yerine HER ZAMAN kök adrese dönülür.
function getRedirectUri() {
  return `${window.location.origin}/`;
}

// "Spotify Hesabını Bağla" butonuna basınca çağrılır — sayfayı Spotify'ın
// yetkilendirme ekranına yönlendirir (tam sayfa redirect, popup DEĞİL —
// popup tabanlı akışlar tarayıcıların pop-up engelleyicileriyle sık
// çakışır). code_verifier ve state, geri dönüşte doğrulanmak üzere
// sessionStorage'da (sekme kapanınca silinir, PKCE'nin "tek seferlik"
// doğasına uygun) saklanır.
export async function startSpotifyLogin() {
  const clientId = getClientId();
  const verifier = randomUrlSafeString(64);
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = randomUrlSafeString(16);

  sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
  sessionStorage.setItem(STATE_STORAGE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
    state,
  });
  window.location.href = `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

// Sayfa yüklendiğinde URL'de Spotify'ın bıraktığı ?code=/?state=/?error=
// parametreleri var mı diye bakar; varsa OKUYUP URL'DEN TEMİZLER (history.
// replaceState — sayfa yenilenince ya da geri/ileri gidilince AYNI kod
// tekrar tüketilmeye çalışılıp "invalid_grant" hatasına yol açmasın diye).
// Parametre yoksa (normal sayfa yüklemesi/navigasyon) null döner.
export function consumeSpotifyRedirectParams() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (!code && !error) return null;

  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);

  return { code, state, error };
}

// Token değişimi — PKCE akışında client secret GEREKMEZ, yalnızca
// code_verifier (sessionStorage'dan) sunulur. `state` CSRF koruması için
// yetkilendirme isteğiyle GÖNDERİLENLE karşılaştırılır.
export async function exchangeCodeForToken(code, state) {
  const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
  sessionStorage.removeItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY);

  if (!verifier || !expectedState || state !== expectedState) {
    throw new Error("Spotify girişi doğrulanamadı (state uyuşmuyor) — lütfen tekrar dene.");
  }

  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });
  const res = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error_description || "Spotify token alışverişi başarısız oldu.");
  return saveTokens(data);
}

// Erişim token'ı süresi dolmadan (bkz. MusicContext.jsx scheduleRefresh)
// yenilemek için. Spotify'ın refresh yanıtı YENİ bir refresh_token
// döndürmeyebilir — bu durumda eskisi korunur (bkz. saveTokens).
export async function refreshSpotifyToken(refreshToken) {
  const body = new URLSearchParams({ client_id: getClientId(), grant_type: "refresh_token", refresh_token: refreshToken });
  const res = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error_description || "Spotify oturumu yenilenemedi.");
  return saveTokens(data);
}

function saveTokens(data) {
  const previous = readStoredTokens();
  const tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || previous?.refreshToken || null,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    /* localStorage erişilemez (gizli sekme/kota) — token yine de bellekte (MusicContext state'inde) bu oturum boyunca çalışır */
  }
  return tokens;
}

export function readStoredTokens() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStoredTokens() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* yok sayılır */
  }
}
