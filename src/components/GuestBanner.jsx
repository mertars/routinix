import { Save } from "lucide-react";

// Misafir (anonim) kullanıcı şeridi — YALNIZCA `auth.isAnonymous === true`
// iken app.jsx tarafından mount edilir (bkz. oradaki `{auth.isAnonymous &&
// <GuestBanner .../>}`) — gerçek bir hesaba geçildiği an TÜMÜYLE unmount
// olur, sahte bir "gizle" state'i YOKTUR (bu kodun geri kalanındaki "View
// Isolation" ilkesiyle aynı: kapalıyken hiçbir DOM/iz kalmaz).
//
// KONUM: Header'ın (sticky top-0 z-20) HEMEN ALTINDA, DOM'da bir sonraki
// kardeş olarak render edilir ve KENDİSİ DE `sticky top-0` kullanır —
// Header'ın piksel yüksekliğini elle hesaplamaya (kırılgan, responsive'te
// bozulur) hiç gerek yok: art arda gelen `sticky top-0` elemanlar tarayıcıda
// doğal olarak ÜST ÜSTE İSTİFLENİR (Header önce "yapışır", bu şerit onun
// hemen altında yapışır) — bu, bilinen/sağlam bir CSS deseni.
//
// PERFORMANS NOTU: Tek, statik (animasyonsuz) bir `backdrop-blur-md` — bu
// oturumda ısınmaya yol açan asıl örüntü (aynı anda ONLARCA blur'lu kart +
// arkada sonsuza dek koşan bir animasyon) burada YOK: tek bir örnek, koşullu
// mount, sıfır animasyon. Güvenle kullanılabilir.
export default function GuestBanner({ onUpgrade }) {
  return (
    <div className="sticky top-0 z-30 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 px-4 sm:px-6 py-2.5 backdrop-blur-md bg-zinc-900/80 border-b border-zinc-800">
        <span className="flex items-center gap-2 text-[12px] sm:text-[12.5px] font-medium text-zinc-200 leading-snug">
          <span className="text-[14px] shrink-0" aria-hidden="true">
            ⚡
          </span>
          Misafir modundasın. İlerlemelerini ve planlarını kaybetmemek için tek tıkla hesabını bağla.
        </span>
        <button
          onClick={onUpgrade}
          className="shrink-0 self-start sm:self-auto flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold text-black transition-transform active:scale-95 whitespace-nowrap"
          style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
        >
          <Save className="w-3.5 h-3.5" /> Verilerimi Kaydet
        </button>
      </div>
    </div>
  );
}
