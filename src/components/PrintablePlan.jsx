// Baskı/PDF şablonu. Ekranda gizli (.print-root { display:none }), sadece
// window.print() sırasında görünür (bkz. GlobalStyles @media print). Temiz beyaz
// zemin, koyu minimalist yazılar, kare tik kutucukları — mürekkep dostu.
export default function PrintablePlan({ plan, routines = [], weeks = [], days = Infinity }) {
  if (!plan) return <div className="print-root" />;

  const loadedDays = weeks
    .flatMap((w) => w.days || [])
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber);
  // GÜVENCE: `weeks` (dolayısıyla loadedDays) planın GÜNCEL total_days'inden
  // FAZLA gün içerebilir — plan bir "N güne indir" isteğiyle küçültüldüğünde
  // ve bu güne ait görevler (ör. AI'ın delta'sında atladığı bir kenar durum
  // yüzünden) DB'de hâlâ duruyorsa, bu satır olmadan "Tüm Plan" (varsayılan,
  // sınırsız) PDF ihracı bu ARTIK/stale günleri de basardı. plan.total_days
  // BURADA, kullanıcının seçtiği `days` aralığından ÖNCE, her zaman uygulanır
  // — DB'de zaten temizlenmiş olsa bile ikinci bir güvence katmanıdır.
  const withinPlanRange = Number.isFinite(plan.total_days) ? loadedDays.filter((d) => d.dayNumber <= plan.total_days) : loadedDays;
  const limited = Number.isFinite(days) ? withinPlanRange.slice(0, days) : withinPlanRange;
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="print-root">
      <div className="print-header">
        <div className="print-logo">R</div>
        <div>
          <div className="print-title">Routinix Personal Discipline Plan</div>
          <div className="print-subtitle">{plan.title || "Kişisel Plan"}</div>
        </div>
      </div>

      {plan.summary && <p style={{ fontSize: "12px", marginBottom: "16px", color: "#444" }}>{plan.summary}</p>}

      {routines.length > 0 && (
        <div className="print-routines">
          <div className="print-day-title">Genel Rutinler</div>
          {routines.map((r, i) => (
            <div key={r.id || i} className="print-task">
              <span className="print-check" />
              <span>
                {r.frequency ? `[${r.frequency}] ` : ""}
                {r.content}
              </span>
            </div>
          ))}
        </div>
      )}

      {limited.map((d) => (
        <div key={d.dayNumber} className="print-day">
          <div className="print-day-title">{d.dayNumber}. Gün</div>
          {(d.tasks || []).map((t) => (
            <div key={t.id} className="print-task">
              <span className="print-check" />
              <span>
                {t.title}
                {t.duration_min ? `  ·  ${t.duration_min} dk` : ""}
                {t.priority ? `  ·  ${t.priority}` : ""}
                {t.detail ? <span className="print-task-detail"> — {t.detail}</span> : null}
              </span>
            </div>
          ))}
        </div>
      ))}

      <div className="print-footer">Routinix · Kişisel Disiplin Planı · {today}</div>
    </div>
  );
}
