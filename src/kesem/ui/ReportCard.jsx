import { forwardRef } from "react";
import { Amt } from "./Amt";
import { Bubble } from "./icons";
import { formatMoney } from "../model/money";

// Paylaşılabilir aylık rapor kartı. html-to-image ile PNG'ye çevrilir; bu yüzden backdrop-filter KULLANMAZ,
// yalnızca tema jetonları (CSS değişkenleri) — seçili tema/gündüz-gece ile aynı görünür.
const ReportCard = forwardRef(function ReportCard({ label, total, compare, top, insights, budget, streak, income }, ref) {
  return (
    <div ref={ref} className="k-report" data-k-report>
      <div className="k-report-brand">Harcama Takibi · {label}</div>
      <div className="k-report-cap">Toplam harcama</div>
      <div className="k-report-total"><Amt>{formatMoney(total, "TRY", { hideZeroDecimals: true })}</Amt></div>
      {compare && <div className="k-report-pill">{compare}</div>}
      <div className="k-report-list">
        {top.map((t) => (
          <div key={t.id} className="k-report-row">
            <Bubble icon={t.icon} color={t.color} size={30} />
            <span className="k-report-name">{t.label}</span>
            <span className="k-report-bar"><i style={{ width: `${Math.max(4, t.share * 100)}%`, background: `var(--kc-${t.color})` }} /></span>
            <b><Amt>{formatMoney(t.value, "TRY", { hideZeroDecimals: true })}</Amt></b>
          </div>
        ))}
        {top.length === 0 && <div className="k-report-empty">Bu dönemde harcama yok.</div>}
      </div>
      <div className="k-report-grid">
        <div><span>Günlük ortalama</span><b><Amt>{formatMoney(insights.avgDaily, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
        <div><span>En sık yer</span><b>{insights.topMerchant ? insights.topMerchant.name : "—"}</b></div>
        <div><span>Gelir</span><b><Amt>{formatMoney(income, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
        <div><span>{budget ? "Bütçe kullanımı" : "Harcamasız seri"}</span><b>{budget ? `%${Math.round(budget * 100)}` : `${streak} gün`}</b></div>
      </div>
      <div className="k-report-foot">Routinix</div>
    </div>
  );
});
export default ReportCard;
