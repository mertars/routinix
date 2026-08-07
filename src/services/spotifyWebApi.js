// Spotify Web API — yalnızca kullanıcının kendi OAuth access token'ıyla
// (bkz. utils/spotifyPkce.js), doğrudan tarayıcıdan çağrılır. Hiçbir
// SUNUCU/proxy adımı yok — Spotify Web API zaten CORS'a açık ve token
// zaten yalnızca BU kullanıcıya ait kısıtlı bir yetki taşıyor (kendi
// profili/kendi listeleri), bu yüzden api/*.js üzerinden bir Vercel
// fonksiyonuna sarmalamanın (Gemini anahtarı gibi GİZLİ bir sunucu
// anahtarını korumak dışında) bir güvenlik faydası yok.
const API_BASE = "https://api.spotify.com/v1";

async function spotifyFetch(path, accessToken) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const err = new Error(`Spotify API isteği başarısız oldu (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchSpotifyProfile(accessToken) {
  const data = await spotifyFetch("/me", accessToken);
  return { id: data.id, displayName: data.display_name || data.id, imageUrl: data.images?.[0]?.url || null };
}

// Yalnızca kullanıcının kendi oluşturduğu/takip ettiği listeleri döner —
// {id, label, imageUrl, ownerName} şekline normalize edilir (SPOTIFY_PRESET_
// PLAYLISTS İLE AYNI {id,label} sözleşmesi, MusicContext'te birlikte kullanılabilsin
// diye). İlk 50 liste ile sınırlı — odak müziği seçici için fazlasıyla
// yeterli; tam sayfalama (offset/next) bu kapsamda gerekli görülmedi.
export async function fetchUserPlaylists(accessToken) {
  const data = await spotifyFetch("/me/playlists?limit=50", accessToken);
  return (data.items || [])
    .filter(Boolean)
    .map((p) => ({ id: p.id, label: p.name || "(İsimsiz liste)", imageUrl: p.images?.[0]?.url || null, ownerName: p.owner?.display_name || null }));
}
