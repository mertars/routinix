// Ana thread'i meşgul eden (özellikle bir parmak hareketi/scroll sürüyorken)
// görsel-olmayan işleri (ör. arkaplan DB yazması) tarayıcının boşta kaldığı
// ana kadar erteler. Safari (iOS dahil) requestIdleCallback'i HİÇ desteklemez
// — bu yüzden setTimeout tabanlı bir düşüş her zaman şart.
const ric =
  typeof window !== "undefined" && typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback
    : (fn) => setTimeout(fn, 1);

export function runWhenIdle(fn) {
  ric(fn);
}
