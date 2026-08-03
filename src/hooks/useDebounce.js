import { useState, useEffect } from "react";

// Genel amaçlı debounce hook'u — `value` yalnızca `delayMs` boyunca
// DEĞİŞMEDEN kaldığında güncellenen "gecikmeli" bir kopyasını döner.
// CommunityHub.jsx'in arama çubuğu bunu kullanır: her tuş vuruşunda
// Supabase'e sorgu atmak yerine, kullanıcı yazmayı bir an durdurunca TEK
// bir sorgu gider.
export default function useDebounce(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
