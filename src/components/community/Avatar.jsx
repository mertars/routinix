import { useState } from "react";

// Paylaşılan avatar — dış servisten (pravatar.cc) gelen bot avatarları ağ
// hatası/engelleme yüzünden kırılabilir; `avatar_url` doluysa bile `onError`
// tetiklenince baş harfe düşer, kırık-görsel ikonu asla görünmez.
export default function Avatar({ src, name, size = "w-6 h-6", textSize = "text-[10px]" }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <span className={`${size} rounded-full overflow-hidden shrink-0 bg-white/10 flex items-center justify-center ${textSize} font-bold text-slate-300`}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </span>
  );
}
