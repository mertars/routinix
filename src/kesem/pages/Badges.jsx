import { Award, Flame, Lock } from "lucide-react";
import { Page, Bar } from "../ui/parts";
import { useKesem } from "../state/store";
import { useFinance } from "../state/derived";
import { badgeList } from "../model/finance";

export default function BadgesPage({ onBack }) {
  const k = useKesem();
  const f = useFinance();
  const list = badgeList({ txs: k.transactions, streak: f.streak, budget: k.budget, goals: k.goals, debts: k.debts, now: f.now });
  const earned = list.filter((b) => b.earned).length;
  return (
    <Page title="Rozetler" subtitle={`${earned} / ${list.length} kazanıldı`} onBack={onBack}>
      <div className="k-bento-wrap">
        <div className="k-bento">
          <section className="k-card hero b-3x1" aria-label="Harcamasız gün serisi">
            <div className="k-row-between">
              <div>
                <div className="k-cap">Harcamasız gün serisi</div>
                <div className="k-num xl">{f.streak.current}<span className="k-muted" style={{ fontSize: 20, fontWeight: 600 }}> gün</span></div>
              </div>
              <Flame size={44} className="k-accent-text" aria-hidden="true" />
            </div>
            <div className="k-row-between" style={{ marginTop: 10 }}>
              <span className="k-muted" style={{ fontSize: 13.5 }}>En uzun {f.streak.longest} gün</span>
              <span className={`k-pill ${f.streak.spentToday ? "near" : "ok"}`}>{f.streak.spentToday ? "Bugün harcama var" : "Bugün harcamasız"}</span>
            </div>
          </section>
          <section className="k-card calm b-3x1" style={{ "--wt": 3 }}>
            <div className="k-cap">Nasıl sayılır?</div>
            <p className="k-muted" style={{ fontSize: 13.5 }}>Uygulamayı açtığın ve elle harcama girmediğin gün serine eklenir. Otomatik taksit ve abonelik kayıtları seriyi bozmaz.</p>
          </section>
          {list.map((b, i) => (
            <div key={b.key} className={`k-card ${b.earned ? "accent" : "calm"} b-1x1`} style={i === 0 ? { "--wt": 2 } : undefined}>
              <span className={`k-badge-medal ${b.earned ? "" : "off"}`}>{b.earned ? <Award size={22} /> : <Lock size={18} />}</span>
              <div style={{ minWidth: 0 }}>
                <div className="k-tile-title" style={{ fontSize: 13.5 }}>{b.title}</div>
                <div className="k-tile-sub" style={{ fontSize: 11.5 }}>{b.desc}</div>
              </div>
              {b.target > 1 && !b.earned && <Bar value={b.progress / b.target} />}
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
