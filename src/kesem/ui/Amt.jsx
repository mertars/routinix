// Gizlilik modunda tutarı bulanıklaştıran sarmalayıcı (CSS: .kesem-root[data-k-privacy="1"] .k-amt).
// Metin gerektiren yerlerde (bildirim şeridi, aria-label) `formatMoneyText` kullanılır (maskeli).
// Çok uzun tutarlar (ör. 9.999.999,99 ₺) büyük rakam alanlarında taşmasın diye yazı boyutu uzunluğa göre küçülür (CSS: .k-num .k-amt.nXX).
export const Amt = ({ children }) => {
  const n = typeof children === "string" ? children.length : 0;
  return <span className={`k-amt${n >= 16 ? " n16" : n >= 14 ? " n14" : n >= 12 ? " n12" : ""}`}>{children}</span>;
};
