"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { balanceTeams, BalanceError, lineupKey } from "@/lib/balancer";
import { getFormation } from "@/lib/constants";
import { randomSeed } from "@/lib/ids";
import { useKarma } from "@/lib/store";
import { ResultView } from "../builder/result-view";
import { SetupView } from "../builder/setup-view";
import { EmptyState } from "../empty-state";
import { LogoMark } from "../logo";
import { PageHeader } from "../page-header";
import { Button } from "../ui/button";
import { toast } from "../ui/toast";

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

export function BuilderScreen() {
  const players = useKarma((s) => s.players);
  const builder = useKarma((s) => s.builder);
  const update = useKarma((s) => s.updateBuilder);
  const weights = useKarma((s) => s.settings.weights);
  const loadSample = useKarma((s) => s.loadSample);
  const [view, setView] = useState<"setup" | "result">(() => (builder.alternatives.length ? "result" : "setup"));
  const [running, setRunning] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const shown = useRef<Set<string>>(new Set(builder.alternatives.map(lineupKey)));

  // Seçimi oyuncu listesiyle eşitle: aktif oyuncular değiştiyse seçim aktiflere döner.
  useEffect(() => {
    const ids = new Set(players.map((p) => p.id));
    const actives = players.filter((p) => p.active).map((p) => p.id);
    const b = useKarma.getState().builder;
    if (!sameSet(actives, b.knownIds)) {
      update({ selectedIds: actives, knownIds: actives, alternatives: [] });
      setView("setup");
    } else if (b.selectedIds.some((id) => !ids.has(id))) {
      update({ selectedIds: b.selectedIds.filter((id) => ids.has(id)) });
    }
  }, [players, update]);

  useEffect(() => {
    if (view === "result" && builder.alternatives.length === 0) setView("setup");
  }, [view, builder.alternatives.length]);

  const run = (reshuffle: boolean) => {
    const b = useKarma.getState().builder;
    const selected = players.filter((p) => b.selectedIds.includes(p.id));
    const formations = [getFormation(b.formations[0], b.format), getFormation(b.formations[1], b.format)] as const;
    const needed = formations[0].slots.length + formations[1].slots.length;
    const extra = Math.max(0, selected.length - needed);
    const manualOut = b.extraMode === "bench" ? b.benchIds.filter((id) => b.selectedIds.includes(id)).slice(0, extra) : [];
    const pool = selected.filter((p) => !manualOut.includes(p.id));
    if (!reshuffle) shown.current = new Set();

    setRunning(true);
    // Karıştırma animasyonu görünsün diye hesaplamayı kısa bir gecikmeyle başlat.
    setTimeout(() => {
      try {
        const seed = randomSeed();
        const result = balanceTeams(
          {
            players: pool,
            formations: [formations[0], formations[1]],
            extraMode: b.extraMode,
            rotatingKeeper: b.rotatingKeeper,
            constraints: b.constraints,
            weights,
          },
          { seed, exclude: shown.current },
        );
        const lineups = result.lineups.map((l) => ({ ...l, out: [...l.out, ...manualOut] }));
        lineups.forEach((l) => shown.current.add(lineupKey(l)));
        update({ alternatives: lineups, activeAlternative: 0, seed });
        setWarnings(result.warnings);
        setView("result");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        toast(e instanceof BalanceError ? e.message : "Kadro kurulamadı.", "error");
      } finally {
        setRunning(false);
      }
    }, 650);
  };

  if (players.length < 2) {
    return (
      <main className="pb-nav">
        <PageHeader title="Kadro Kur" eyebrow="Karma" />
        <EmptyState title="Önce oyuncular" description="Kadro kurmak için en az 10 oyuncu (5v5) gerekiyor. Oyuncularını ekle ya da örnek grubu yükle.">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              loadSample();
              toast("14 örnek oyuncu yüklendi");
            }}
          >
            <Sparkles className="size-5" aria-hidden="true" /> Örnek 14 oyuncu yükle
          </Button>
          <Link href="/oyuncular" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-pitch-700 px-6 font-medium">
            <Users className="size-5" aria-hidden="true" /> Oyunculara git
          </Link>
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="pb-nav">
      <PageHeader
        title={view === "result" && builder.alternatives.length ? "Kadro hazır" : "Kadro Kur"}
        eyebrow="Karma"
        subtitle={view === "result" && builder.alternatives.length ? `${builder.format}v${builder.format} · alternatifler arasında gez, elle düzenle` : "Gelenleri seç, formatı belirle, Karma'la."}
      />
      {view === "result" && builder.alternatives.length > 0 ? (
        <ResultView onEdit={() => setView("setup")} onReshuffle={() => run(true)} running={running} warnings={warnings} />
      ) : (
        <SetupView onRun={() => run(false)} running={running} />
      )}
      <ShuffleOverlay show={running} />
    </main>
  );
}

/** "Karma Yap" sırasında kartların karıştırıldığı kısa animasyon. */
function ShuffleOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[55] grid place-items-center bg-pitch-950/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="status"
          aria-label="Takımlar karıştırılıyor"
        >
          <div className="relative h-40 w-40">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="player-card absolute left-1/2 top-1/2 h-28 w-20 -ml-10 -mt-14"
                data-tier={["gold", "silver", "special", "bronze", "gold"][i]}
                animate={{
                  x: [0, (i - 2) * 34, 0, (2 - i) * 30, 0],
                  rotate: [0, (i - 2) * 14, 0, (2 - i) * 10, 0],
                  y: [0, -8, 0, 6, 0],
                }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.04 }}
              />
            ))}
            <div className="absolute inset-x-0 -bottom-10 flex items-center justify-center gap-2 font-display text-xl font-bold uppercase tracking-widest">
              <LogoMark size={22} /> Karıştırılıyor
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
