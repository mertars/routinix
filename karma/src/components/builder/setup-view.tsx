"use client";

import { AlertTriangle, Check, ChevronDown, Palette, Shuffle } from "lucide-react";
import { useMemo, useState } from "react";
import { rosterStatus } from "@/lib/balancer";
import { DEFAULT_FORMATIONS, formationsFor, getFormation, MATCH_FORMATS } from "@/lib/constants";
import { overallRating } from "@/lib/scoring";
import { useKarma, usePlayerMap } from "@/lib/store";
import { POSITIONS, type MatchFormat, type TeamStyle } from "@/lib/types";
import { PlayerAvatar, PositionBadge, RatingPill } from "../player/bits";
import { Button } from "../ui/button";
import { Section, Segmented, Toggle } from "../ui/controls";
import { ConstraintsEditor } from "./constraints-editor";
import { FormationThumb } from "./formation-thumb";
import { TeamStyleSheet } from "./team-style-sheet";

export function SetupView({ onRun, running }: { onRun: () => void; running: boolean }) {
  const players = useKarma((s) => s.players);
  const weights = useKarma((s) => s.settings.weights);
  const defaultFormations = useKarma((s) => s.settings.defaultFormations);
  const builder = useKarma((s) => s.builder);
  const update = useKarma((s) => s.updateBuilder);
  const playerMap = usePlayerMap();
  const [editingTeam, setEditingTeam] = useState<0 | 1 | null>(null);
  const [listOpen, setListOpen] = useState(true);

  const selectedSet = useMemo(() => new Set(builder.selectedIds), [builder.selectedIds]);
  const selected = players.filter((p) => selectedSet.has(p.id));
  const formations: [ReturnType<typeof getFormation>, ReturnType<typeof getFormation>] = [
    getFormation(builder.formations[0], builder.format),
    getFormation(builder.formations[1], builder.format),
  ];
  const status = rosterStatus(selected.length, formations);
  const sortedPlayers = useMemo(
    () =>
      [...players].sort(
        (a, b) => Number(b.active) - Number(a.active) || POSITIONS.indexOf(a.primaryPosition) - POSITIONS.indexOf(b.primaryPosition) || a.name.localeCompare(b.name, "tr"),
      ),
    [players],
  );
  const keepers = selected.filter((p) => p.primaryPosition === "KL").length;
  const benchIds = builder.benchIds.filter((id) => selectedSet.has(id));
  const suggestedFormat = ([...MATCH_FORMATS].reverse().find((f) => f * 2 <= selected.length) ?? null) as MatchFormat | null;

  const toggle = (id: string) =>
    update((b) => ({ selectedIds: b.selectedIds.includes(id) ? b.selectedIds.filter((x) => x !== id) : [...b.selectedIds, id], alternatives: [] }));

  const setFormat = (format: MatchFormat) => {
    const f = defaultFormations[format] ?? DEFAULT_FORMATIONS[format];
    update({ format, formations: [f, f], alternatives: [] });
  };

  const setFormation = (team: 0 | 1, id: string) =>
    update((b) => {
      const next: [string, string] = [...b.formations];
      next[team] = id;
      return { formations: next, alternatives: [] };
    });

  const toggleBench = (id: string) =>
    update((b) => {
      const current = b.benchIds.filter((x) => b.selectedIds.includes(x));
      if (current.includes(id)) return { benchIds: current.filter((x) => x !== id) };
      if (current.length >= status.extra) return { benchIds: [...current.slice(1), id] };
      return { benchIds: [...current, id] };
    });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4">
      {/* 1. Oyuncular */}
      <Section
        title="Kim geliyor?"
        subtitle={
          <span>
            <strong className="text-ink">{selected.length}</strong> / {players.length} seçili · {keepers} kaleci
          </span>
        }
        action={
          <button
            type="button"
            onClick={() => setListOpen((o) => !o)}
            aria-expanded={listOpen}
            aria-label={listOpen ? "Oyuncu listesini daralt" : "Oyuncu listesini aç"}
            className="grid size-11 place-items-center rounded-xl text-ink-muted hover:bg-white/5"
          >
            <ChevronDown className={`size-5 transition-transform ${listOpen ? "rotate-180" : ""}`} />
          </button>
        }
      >
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Button size="sm" onClick={() => update({ selectedIds: players.map((p) => p.id), alternatives: [] })}>
            Tümü
          </Button>
          <Button size="sm" onClick={() => update({ selectedIds: players.filter((p) => p.active).map((p) => p.id), alternatives: [] })}>
            Aktifler
          </Button>
          <Button size="sm" onClick={() => update({ selectedIds: [], alternatives: [] })}>
            Temizle
          </Button>
        </div>
        {listOpen && (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" aria-label="Maça gelen oyuncular">
            {sortedPlayers.map((p) => {
              const on = selectedSet.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(p.id)}
                    className={`flex min-h-13 w-full items-center gap-3 rounded-2xl border px-3 py-1.5 text-left transition-colors ${
                      on ? "border-neon/50 bg-neon/8" : "border-white/5 bg-white/[0.02] opacity-70"
                    }`}
                  >
                    <span className={`grid size-6 shrink-0 place-items-center rounded-lg border-2 ${on ? "border-neon bg-neon text-on-neon" : "border-white/25"}`} aria-hidden="true">
                      {on && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    <PlayerAvatar avatar={p.avatar} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{p.name}</span>
                      {!p.active && <span className="block text-[11px] text-ink-faint">Pasif</span>}
                    </span>
                    <PositionBadge position={p.primaryPosition} size="sm" />
                    <RatingPill value={overallRating(p, weights)} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* 2. Format */}
      <Section title="Maç formatı" subtitle={`${status.needed} oyuncu gerekli`}>
        <Segmented
          label="Maç formatı"
          value={builder.format}
          onChange={setFormat}
          options={MATCH_FORMATS.map((f) => ({ value: f, label: `${f}v${f}` }))}
        />
        <div className="mt-3" aria-live="polite">
          {status.missing > 0 ? (
            <div className="flex items-start gap-3 rounded-2xl bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-ink">
                  {builder.format}v{builder.format} için <strong>{status.missing}</strong> oyuncu eksik.
                </p>
                {suggestedFormat && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setFormat(suggestedFormat)}>
                    {suggestedFormat}v{suggestedFormat} oyna
                  </Button>
                )}
              </div>
            </div>
          ) : status.extra > 0 ? (
            <div className="rounded-2xl bg-white/4 p-3">
              <p className="mb-2 text-sm text-ink-soft">
                <strong className="text-ink">{status.extra}</strong> oyuncu fazla. Ne yapalım?
              </p>
              <Segmented
                size="sm"
                label="Fazla oyuncular"
                value={builder.extraMode}
                onChange={(extraMode) => update({ extraMode, alternatives: [] })}
                options={[
                  { value: "bench", label: "Yedek kalsın" },
                  { value: "rotate", label: "Dönüşümlü oynasın" },
                ]}
              />
              {builder.extraMode === "bench" ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-ink-muted">
                    Kim yedek kalsın? {benchIds.length === 0 ? "Seçmezsen Karma dengeye göre seçer." : `${benchIds.length}/${status.extra} seçildi.`}
                  </p>
                  <div className="scrollbar-none -mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
                    {selected.map((p) => {
                      const on = benchIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleBench(p.id)}
                          className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm ${on ? "border-warning bg-warning/15 text-ink" : "border-white/10 text-ink-muted"}`}
                        >
                          <PlayerAvatar avatar={p.avatar} size={22} />
                          {p.name.split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-ink-muted">Fazla oyuncular takımlara dönüşümlü yedek olarak dağıtılır; takım gücü ortalamaya göre hesaplanır.</p>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-neon">
              <Check className="size-4" aria-hidden="true" /> Oyuncu sayısı tam.
            </p>
          )}
        </div>
        <div className="mt-2 border-t border-white/5 pt-1">
          <Toggle
            checked={builder.rotatingKeeper}
            onChange={(rotatingKeeper) => update({ rotatingKeeper, alternatives: [] })}
            label="Kaleci dönüşümlü"
            description="Sabit kaleci yok, herkes sırayla kaleye geçer. Kalecilik puanı hesaba katılmaz."
          />
        </div>
      </Section>

      {/* 3. Diziliş */}
      <Section title="Diziliş" subtitle="İki takım farklı diziliş seçebilir.">
        <div className="flex flex-col gap-4">
          {([0, 1] as const).map((t) => (
            <div key={t}>
              <button
                type="button"
                onClick={() => setEditingTeam(t)}
                className="mb-2 flex min-h-11 w-full items-center gap-2.5 rounded-xl text-left"
                aria-label={`${builder.teamStyles[t].name} takımının adını ve rengini düzenle`}
              >
                <span className="size-4 rounded-full border border-white/30" style={{ background: builder.teamStyles[t].color }} aria-hidden="true" />
                <span className="flex-1 font-semibold">{builder.teamStyles[t].name}</span>
                <Palette className="size-4 text-ink-muted" aria-hidden="true" />
              </button>
              <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label={`${builder.teamStyles[t].name} dizilişi`}>
                {formationsFor(builder.format).map((f) => {
                  const on = formations[t].id === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setFormation(t, f.id)}
                      className={`flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-2 transition-colors ${on ? "border-neon bg-neon/10" : "border-white/8 bg-white/[0.02]"}`}
                    >
                      <FormationThumb formation={f} className="h-16 w-15" />
                      <span className={`font-display text-base font-bold ${on ? "text-ink" : "text-ink-muted"}`}>{f.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 4. Kurallar */}
      <Section title="Kurallar" subtitle="Opsiyonel">
        <ConstraintsEditor
          constraints={builder.constraints}
          players={selected}
          playerMap={playerMap}
          onChange={(constraints) => update({ constraints, alternatives: [] })}
        />
      </Section>

      <div className="sticky bottom-nav z-20 -mx-4 mt-2 bg-gradient-to-t from-pitch-950 via-pitch-950/80 to-transparent px-4 pt-6">
        <Button
          variant="primary"
          size="lg"
          className="h-16 w-full text-lg shadow-glow"
          disabled={status.missing > 0 || running}
          onClick={onRun}
        >
          <Shuffle className={`size-6 ${running ? "animate-spin" : ""}`} aria-hidden="true" />
          {running ? "Karıştırılıyor…" : "Karma Yap"}
        </Button>
        {status.missing > 0 && <p className="mt-2 text-center text-xs text-ink-muted">Karma yapmak için {status.missing} oyuncu daha seç veya formatı düşür.</p>}
      </div>

      <TeamStyleSheet
        open={editingTeam !== null}
        team={editingTeam ?? 0}
        styles={builder.teamStyles}
        onClose={() => setEditingTeam(null)}
        onSave={(teamStyles: [TeamStyle, TeamStyle]) => update({ teamStyles })}
      />
    </div>
  );
}
