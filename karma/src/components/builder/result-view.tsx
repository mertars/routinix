"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Hand, Pencil, Save, Share2, Shuffle, TriangleAlert, Undo2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { evaluateLineup, type Evaluation } from "@/lib/balancer";
import { getFormation, LINE_LABELS, MAIN_ATTR_SHORT } from "@/lib/constants";
import { formatLineupText, lineupToMatch, placeId, swapPlaces, type PlaceId } from "@/lib/lineup";
import { positionFit } from "@/lib/scoring";
import { useKarma, usePlayerMap } from "@/lib/store";
import { MAIN_ATTRS, type Lineup, type Player, type TeamStyle } from "@/lib/types";
import { CompareBars } from "../charts/compare-bars";
import { Button } from "../ui/button";
import { Section } from "../ui/controls";
import { toast } from "../ui/toast";
import { BalanceGauge } from "./balance-gauge";
import { describeConstraint } from "./constraints-editor";
import { MiniCard } from "./mini-card";
import { DraggablePlace, HalfPitch, type SlotView } from "./pitch";
import { ShareSheet } from "./share-sheet";
import { TeamStyleSheet } from "./team-style-sheet";
import { useMediaQuery } from "./use-media-query";

interface ResultViewProps {
  onEdit: () => void;
  onReshuffle: () => void;
  running: boolean;
  warnings: string[];
}

const announcements = {
  onDragStart: () => "Oyuncu seçildi. Ok tuşlarıyla bir yere götürüp boşluk tuşuyla bırak.",
  onDragOver: () => "",
  onDragEnd: ({ over }: { over: { id: string | number } | null }) => (over ? "Oyuncular yer değiştirdi." : "Taşıma iptal edildi."),
  onDragCancel: () => "Taşıma iptal edildi.",
};

export function ResultView({ onEdit, onReshuffle, running, warnings }: ResultViewProps) {
  const builder = useKarma((s) => s.builder);
  const update = useKarma((s) => s.updateBuilder);
  const weights = useKarma((s) => s.settings.weights);
  const players = useKarma((s) => s.players);
  const saveMatch = useKarma((s) => s.saveMatch);
  const playerMap = usePlayerMap();
  const wide = useMediaQuery("(min-width: 768px)");

  const index = Math.min(builder.activeAlternative, builder.alternatives.length - 1);
  const lineup = builder.alternatives[index];
  const [selected, setSelected] = useState<PlaceId | null>(null);
  const [activeId, setActiveId] = useState<PlaceId | null>(null);
  const [history, setHistory] = useState<Lineup[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<0 | 1 | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);

  const formations = useMemo(
    () => [getFormation(lineup.teams[0].formationId, builder.format), getFormation(lineup.teams[1].formationId, builder.format)] as const,
    [lineup, builder.format],
  );
  const evaluation: Evaluation = useMemo(
    () =>
      evaluateLineup(lineup, {
        players,
        formations: [formations[0], formations[1]],
        rotatingKeeper: builder.rotatingKeeper,
        constraints: builder.constraints,
        weights,
      }),
    [lineup, players, formations, builder.rotatingKeeper, builder.constraints, weights],
  );
  const styles = builder.teamStyles;
  const signature = JSON.stringify([lineup.teams, lineup.out]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const commit = (next: Lineup) => {
    setHistory((h) => [...h.slice(-19), lineup]);
    update((b) => {
      const alternatives = [...b.alternatives];
      alternatives[index] = next;
      return { alternatives };
    });
  };

  const swap = (a: PlaceId, b: PlaceId) => {
    if (a === b) return;
    commit(swapPlaces(lineup, a, b));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
  };

  const onTap = (id: PlaceId) => {
    if (!selected) {
      setSelected(id);
      return;
    }
    if (selected !== id) swap(selected, id);
    setSelected(null);
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setSelected(null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (e.over && e.over.id !== e.active.id) swap(String(e.active.id), String(e.over.id));
  };

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= builder.alternatives.length) return;
    setDirection(delta);
    setSelected(null);
    setHistory([]);
    update({ activeAlternative: next });
  };

  const onSwipe = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 60 || info.velocity.x > 500) go(-1);
  };

  const shareText = formatLineupText({
    lineup,
    evaluation,
    players: playerMap,
    styles,
    format: builder.format,
    rotatingKeeper: builder.rotatingKeeper,
  });

  const save = () => {
    const match = lineupToMatch(lineup, evaluation, playerMap, { format: builder.format, rotatingKeeper: builder.rotatingKeeper, styles });
    saveMatch(match);
    setSavedSignature(signature);
    toast("Maç kaydedildi · skoru maçtan sonra gir");
  };

  const placeView = (id: PlaceId): SlotView | null => {
    const m = /^t([01])-([sy])(\d+)$|^o-(\d+)$/.exec(id);
    if (!m) return null;
    if (m[4] !== undefined) {
      const pid = lineup.out[Number(m[4])];
      const p = pid ? playerMap.get(pid) : undefined;
      return p ? { id, player: p, rating: 0, position: "OUT", fit: "primary" } : null;
    }
    const t = Number(m[1]) as 0 | 1;
    const i = Number(m[3]);
    if (m[2] === "y") {
      const pid = lineup.teams[t].subs[i];
      const p = pid ? playerMap.get(pid) : undefined;
      return p ? { id, player: p, rating: Math.round(evaluation.teams[t].subRatings[i] ?? 0), position: "YDK", fit: "primary" } : null;
    }
    const pid = lineup.teams[t].slots[i];
    const p = pid ? playerMap.get(pid) : undefined;
    const pos = formations[t].slots[i].position;
    const rot = pos === "KL" && builder.rotatingKeeper;
    return p
      ? { id, player: p, rating: Math.round(evaluation.teams[t].slotRatings[i] ?? 0), position: pos, fit: rot ? "primary" : positionFit(p, pos), rotatingKeeper: rot }
      : null;
  };
  const activeView = activeId ? placeView(activeId) : null;
  const activeTeam = activeId?.startsWith("t1") ? 1 : activeId?.startsWith("t0") ? 0 : null;

  const dealKey = `${lineup.id}`;
  const lineRows = (["KL", "DEF", "OS", "FV"] as const)
    .filter((l) => evaluation.teams[0].lines[l] !== undefined && evaluation.teams[1].lines[l] !== undefined)
    .map((l) => ({ key: l, label: LINE_LABELS[l].split(" ")[0], a: evaluation.teams[0].lines[l]!, b: evaluation.teams[1].lines[l]! }));

  const teamHeader = (t: 0 | 1) => (
    <div className="flex items-center gap-2.5 px-1 py-2">
      <button
        type="button"
        onClick={() => setEditingTeam(t)}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
        aria-label={`${styles[t].name}: adı ve rengi düzenle`}
      >
        <span className="size-4 shrink-0 rounded-full border border-white/30" style={{ background: styles[t].color }} aria-hidden="true" />
        <span className="truncate font-display text-xl font-bold uppercase tracking-wide">{styles[t].name}</span>
        <Pencil className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
      </button>
      <span className="font-display text-base font-semibold text-ink-muted">{formations[t].name}</span>
      <span className="text-right">
        <span className="block font-display text-2xl font-extrabold leading-none tabular">{Math.round(evaluation.teams[t].total)}</span>
        <span className="block text-[11px] text-ink-muted">ort. {evaluation.teams[t].average.toFixed(1)}</span>
      </span>
    </div>
  );

  const benchRow = (title: string, ids: PlaceId[], color?: string) =>
    ids.length > 0 && (
      <div className="mt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{title}</div>
        <div className="flex flex-wrap gap-3 pb-1">
          {ids.map((id) => {
            const v = placeView(id);
            return v ? <DraggablePlace key={id} slot={v} teamColor={color} selected={selected === id} onTap={onTap} activeId={activeId} /> : null;
          })}
        </div>
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4">
      {/* Alternatifler + denge özeti (kaydırılabilir) */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <ChevronLeft className="size-4" aria-hidden="true" /> Düzenle
        </Button>
        <div className="flex flex-1 items-center justify-end gap-1" role="group" aria-label="Alternatif kadrolar">
          <button type="button" onClick={() => go(-1)} disabled={index === 0} className="grid size-11 place-items-center rounded-xl text-ink-soft disabled:opacity-30" aria-label="Önceki alternatif">
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex items-center gap-1.5 px-1">
            {builder.alternatives.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i - index)}
                aria-label={`Alternatif ${i + 1}`}
                aria-current={i === index}
                className="grid size-7 place-items-center"
              >
                <span className={`block rounded-full transition-all ${i === index ? "h-2.5 w-6 bg-neon" : "size-2.5 bg-white/25"}`} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index >= builder.alternatives.length - 1}
            className="grid size-11 place-items-center rounded-xl text-ink-soft disabled:opacity-30"
            aria-label="Sonraki alternatif"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.section
          key={lineup.id}
          custom={direction}
          className="surface touch-pan-y rounded-3xl p-4"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.35}
          onDragEnd={onSwipe}
          initial={{ opacity: 0, x: direction * 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -60 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          aria-label={`Alternatif ${index + 1} / ${builder.alternatives.length}`}
        >
          <div className="mb-1 text-xs font-semibold text-neon">
            Alternatif {index + 1} / {builder.alternatives.length}
            <span className="ml-2 font-normal text-ink-faint">· kaydırarak gez</span>
          </div>
          <BalanceGauge value={evaluation.balance} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {([0, 1] as const).map((t) => (
              <div key={t} className="flex items-center gap-2 rounded-2xl bg-white/4 px-3 py-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: styles[t].color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-ink-soft">{styles[t].name}</span>
                <span className="font-display text-lg font-bold tabular">{evaluation.teams[t].average.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </AnimatePresence>

      {(warnings.length > 0 || evaluation.violations.length > 0) && (
        <div className="flex flex-col gap-2" role="alert">
          {[...warnings, ...evaluation.violations.map((id) => {
            const c = builder.constraints.find((x) => x.id === id);
            return c ? `Kural karşılanmıyor: ${describeConstraint(c, playerMap)}` : "";
          })]
            .filter(Boolean)
            .map((w) => (
              <p key={w} className="flex items-start gap-2 rounded-2xl bg-warning/10 px-3 py-2.5 text-sm text-ink">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" /> {w}
              </p>
            ))}
        </div>
      )}

      {/* Saha */}
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{ announcements, screenReaderInstructions: { draggable: "Oyuncuyu taşımak için boşluk tuşuna bas, ok tuşlarıyla hedefe götür, tekrar boşlukla bırak." } }}
      >
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Hand className="size-4" aria-hidden="true" />
          <span className="flex-1">Takas için iki oyuncuya sırayla dokun ya da basılı tutup sürükle.</span>
          {history.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const prev = history[history.length - 1];
                setHistory((h) => h.slice(0, -1));
                update((b) => {
                  const alternatives = [...b.alternatives];
                  alternatives[index] = prev;
                  return { alternatives };
                });
              }}
            >
              <Undo2 className="size-4" aria-hidden="true" /> Geri al
            </Button>
          )}
        </div>

        <div className={wide ? "grid grid-cols-2 gap-4" : "flex flex-col"}>
          {([0, 1] as const).map((t) => (
            <div key={t} className={!wide && t === 1 ? "flex flex-col-reverse" : ""}>
              {teamHeader(t)}
              <HalfPitch
                team={t}
                formation={formations[t]}
                lineupTeam={lineup.teams[t]}
                evaluation={evaluation.teams[t]}
                players={playerMap}
                color={styles[t].color}
                goalAtTop={!wide && t === 0}
                joined={!wide}
                rotatingKeeper={builder.rotatingKeeper}
                selected={selected}
                activeId={activeId}
                onTap={onTap}
                dealKey={dealKey}
              />
              {wide && benchRow("Dönüşümlü yedek", lineup.teams[t].subs.map((_, i) => placeId(t, "sub", i)), styles[t].color)}
            </div>
          ))}
        </div>
        {!wide &&
          ([0, 1] as const).map((t) => (
            <div key={t}>{benchRow(`${styles[t].name} · dönüşümlü yedek`, lineup.teams[t].subs.map((_, i) => placeId(t, "sub", i)), styles[t].color)}</div>
          ))}
        {benchRow("Bu maç oynamıyor", lineup.out.map((_, i) => placeId(-1, "out", i)))}

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activeView?.player ? (
            <div className="rotate-3 scale-110 drop-shadow-2xl">
              <MiniCard
                player={activeView.player as Player}
                rating={activeView.rating}
                position={activeView.position}
                fit={activeView.fit}
                teamColor={activeTeam !== null ? styles[activeTeam].color : undefined}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Karşılaştırma */}
      <Section title="Takım karşılaştırması" subtitle="Dış saha oyuncularının özellik ortalamaları">
        <CompareBars
          title="Takımların 6 ana özellik ortalaması"
          names={[styles[0].name, styles[1].name]}
          colors={[styles[0].color, styles[1].color]}
          rows={MAIN_ATTRS.map((k) => ({ key: k, label: MAIN_ATTR_SHORT[k], a: evaluation.teams[0].attrs[k], b: evaluation.teams[1].attrs[k] }))}
        />
        <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Hat ortalamaları</h3>
        <CompareBars title="Hat bazında ortalama puan" names={[styles[0].name, styles[1].name]} colors={[styles[0].color, styles[1].color]} rows={lineRows} />
      </Section>

      {/* Aksiyonlar */}
      <div className="sticky bottom-nav z-20 -mx-4 grid grid-cols-[auto_1fr_1fr] gap-2 bg-gradient-to-t from-pitch-950 via-pitch-950/85 to-transparent px-4 pt-6">
        <Button size="lg" onClick={onReshuffle} disabled={running} aria-label="Tekrar karıştır" className="px-4">
          <Shuffle className={`size-5 ${running ? "animate-spin" : ""}`} aria-hidden="true" />
        </Button>
        <Button size="lg" onClick={() => setShareOpen(true)}>
          <Share2 className="size-5" aria-hidden="true" /> Paylaş
        </Button>
        {savedSignature === signature ? (
          <Link
            href="/maclar"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-neon/40 px-4 font-semibold text-neon"
          >
            Maçlara git
          </Link>
        ) : (
          <Button variant="primary" size="lg" onClick={save}>
            <Save className="size-5" aria-hidden="true" /> Kaydet
          </Button>
        )}
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        text={shareText}
        lineup={lineup}
        evaluation={evaluation}
        players={playerMap}
        styles={styles}
        format={builder.format}
        rotatingKeeper={builder.rotatingKeeper}
      />
      <TeamStyleSheet
        open={editingTeam !== null}
        team={editingTeam ?? 0}
        styles={styles}
        onClose={() => setEditingTeam(null)}
        onSave={(teamStyles: [TeamStyle, TeamStyle]) => update({ teamStyles })}
      />
    </div>
  );
}
