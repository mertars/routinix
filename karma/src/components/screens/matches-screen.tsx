"use client";

import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, Shuffle, Star, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getFormation, POSITION_LABELS } from "@/lib/constants";
import { formatDateTr } from "@/lib/lineup";
import { allPlayerStats, matchResultFor, RESULT_LABELS, type Result } from "@/lib/stats";
import { useKarma, usePlayerMap } from "@/lib/store";
import type { Match } from "@/lib/types";
import { EmptyState } from "../empty-state";
import { PageHeader } from "../page-header";
import { PlayerAvatar, PositionBadge } from "../player/bits";
import { Button } from "../ui/button";
import { ConfirmSheet } from "../ui/confirm";
import { Segmented, Stepper } from "../ui/controls";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

const RESULT_COLOR: Record<Result, string> = { G: "var(--color-neon)", B: "#7d8f86", M: "var(--color-danger)" };

export function ResultDot({ result, small }: { result: Result; small?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-display font-extrabold text-ink ${small ? "size-5 text-[10px]" : "size-6 text-xs"}`}
      style={{ background: `color-mix(in srgb, ${RESULT_COLOR[result]} 22%, transparent)`, boxShadow: `inset 0 0 0 1.5px ${RESULT_COLOR[result]}` }}
      title={RESULT_LABELS[result]}
    >
      {result}
    </span>
  );
}

export function MatchesScreen() {
  const matches = useKarma((s) => s.matches);
  const [tab, setTab] = useState<"list" | "stats">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = useMemo(() => [...matches].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), [matches]);
  const open = matches.find((m) => m.id === openId) ?? null;
  const pending = matches.filter((m) => !m.score).length;

  if (matches.length === 0) {
    return (
      <main className="pb-nav">
        <PageHeader title="Maçlar" eyebrow="Karma" />
        <EmptyState title="Henüz maç yok" description="Kadro kurduktan sonra “Kaydet” de. Maçtan sonra skoru girersen galibiyet oranları ve form grafikleri burada birikir.">
          <Link href="/kadro" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-neon px-6 font-semibold text-on-neon shadow-glow">
            <Shuffle className="size-5" aria-hidden="true" /> Kadro kur
          </Link>
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="pb-nav">
      <PageHeader
        title="Maçlar"
        eyebrow="Karma"
        subtitle={
          <>
            {matches.length} maç{pending > 0 && <span className="text-warning"> · {pending} maçın skoru bekleniyor</span>}
          </>
        }
      />
      <div className="mx-auto w-full max-w-2xl px-4">
        <Segmented
          label="Görünüm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "list", label: "Maçlar" },
            { value: "stats", label: "İstatistikler" },
          ]}
        />
        {tab === "list" ? (
          <ul className="mt-4 flex flex-col gap-3">
            {sorted.map((m, i) => (
              <motion.li key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.04 } }}>
                <MatchCard match={m} onOpen={() => setOpenId(m.id)} />
              </motion.li>
            ))}
          </ul>
        ) : (
          <StatsTable />
        )}
      </div>
      <MatchSheet match={open} onClose={() => setOpenId(null)} />
    </main>
  );
}

function MatchCard({ match, onOpen }: { match: Match; onOpen: () => void }) {
  const playerMap = usePlayerMap();
  const mvp = match.mvpId ? playerMap.get(match.mvpId) ?? null : null;
  const mvpName = mvp?.name ?? match.teams.flatMap((t) => t.players).find((p) => p.playerId === match.mvpId)?.name;
  const winner = match.score ? (match.score.a > match.score.b ? 0 : match.score.a < match.score.b ? 1 : null) : null;
  return (
    <button type="button" onClick={onOpen} className="surface block w-full rounded-3xl p-4 text-left transition-transform active:scale-[0.99]">
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <CalendarDays className="size-3.5" aria-hidden="true" />
        <span className="flex-1">
          {formatDateTr(match.date)} · {match.format}v{match.format}
        </span>
        <span>Denge %{match.balance}</span>
        <ChevronRight className="size-4" aria-hidden="true" />
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {([0, 1] as const).map((t) => (
          <div key={t} className={`flex min-w-0 items-center gap-2 ${t === 1 ? "order-3 flex-row-reverse text-right" : ""}`}>
            <span className="size-3.5 shrink-0 rounded-full border border-white/25" style={{ background: match.teams[t].color }} aria-hidden="true" />
            <span className={`truncate font-semibold ${winner === t ? "text-ink" : "text-ink-soft"}`}>
              {match.teams[t].name}
              {winner === t && <Trophy className="ml-1 inline size-3.5 text-warning" aria-label="kazanan" />}
            </span>
          </div>
        ))}
        <div className="order-2 text-center">
          {match.score ? (
            <span className="font-display text-3xl font-extrabold tabular">
              {match.score.a} – {match.score.b}
            </span>
          ) : (
            <span className="rounded-full bg-warning/15 px-3 py-1.5 text-xs font-semibold text-warning">Skor gir</span>
          )}
        </div>
      </div>
      {mvpName && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
          <Star className="size-3.5 fill-warning text-warning" aria-hidden="true" /> Maçın adamı: <strong className="text-ink">{mvpName}</strong>
        </div>
      )}
    </button>
  );
}

function MatchSheet({ match, onClose }: { match: Match | null; onClose: () => void }) {
  return (
    <Sheet open={match !== null} onClose={onClose} title="Maç detayı" full>
      {match && <MatchBody key={match.id} match={match} onClose={onClose} />}
    </Sheet>
  );
}

function MatchBody({ match, onClose }: { match: Match; onClose: () => void }) {
  const updateMatch = useKarma((s) => s.updateMatch);
  const deleteMatch = useKarma((s) => s.deleteMatch);
  const playerMap = usePlayerMap();
  const [a, setA] = useState(match.score?.a ?? 0);
  const [b, setB] = useState(match.score?.b ?? 0);
  const [date, setDate] = useState(match.date);
  const [mvpId, setMvpId] = useState<string | undefined>(match.mvpId);
  const [confirm, setConfirm] = useState(false);
  const everyone = match.teams.flatMap((t, ti) => t.players.map((p) => ({ ...p, team: ti })));

  const save = () => {
    updateMatch(match.id, { score: { a, b }, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : match.date, mvpId });
    toast("Maç güncellendi");
    onClose();
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Tarih</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 w-full rounded-2xl border border-white/10 bg-pitch-800 px-4 text-[16px] text-ink outline-none focus:border-neon [color-scheme:dark]"
        />
      </label>

      <div className="surface rounded-3xl p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Skor</div>
        <div className="grid grid-cols-2 gap-3">
          {([0, 1] as const).map((t) => (
            <div key={t} className="flex flex-col items-center gap-2">
              <span className="flex max-w-full items-center gap-1.5 truncate text-sm font-semibold">
                <span className="size-3 shrink-0 rounded-full border border-white/25" style={{ background: match.teams[t].color }} aria-hidden="true" />
                {match.teams[t].name}
              </span>
              <Stepper label={`${match.teams[t].name} golü`} value={t === 0 ? a : b} onChange={t === 0 ? setA : setB} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Maçın adamı (opsiyonel)</div>
        <div className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="radiogroup" aria-label="Maçın adamı">
          {everyone.map((p) => {
            const player = playerMap.get(p.playerId);
            const on = mvpId === p.playerId;
            return (
              <button
                key={p.playerId}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMvpId(on ? undefined : p.playerId)}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm ${on ? "border-warning bg-warning/15 text-ink" : "border-white/10 text-ink-muted"}`}
              >
                {on ? <Star className="size-4 fill-warning text-warning" aria-hidden="true" /> : player && <PlayerAvatar avatar={player.avatar} size={22} />}
                {p.name.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {([0, 1] as const).map((t) => {
          const team = match.teams[t];
          const result = match.score ? matchResultFor(match, t) : null;
          return (
            <div key={t} className="surface rounded-3xl p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="size-3.5 rounded-full border border-white/25" style={{ background: team.color }} aria-hidden="true" />
                <span className="flex-1 truncate font-display text-lg font-bold uppercase">{team.name}</span>
                {result && <ResultDot result={result} />}
              </div>
              <div className="mb-2 text-xs text-ink-muted">
                {getFormation(team.formationId, match.format).name} · ort. {team.average.toFixed(1)}
              </div>
              <ul className="flex flex-col gap-1">
                {team.players.map((p) => (
                  <li key={p.playerId} className="flex items-center gap-2 text-sm">
                    <PositionBadge position={p.position} size="sm" title={p.position === "YDK" ? "Yedek" : POSITION_LABELS[p.position]} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="font-display font-bold tabular text-ink-soft">{p.rating}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {match.out.length > 0 && (
        <p className="text-sm text-ink-muted">Yedek kalan: {match.out.map((id) => playerMap.get(id)?.name ?? "?").join(", ")}</p>
      )}

      <div className="sticky bottom-0 -mx-5 flex gap-3 border-t border-white/6 bg-pitch-900/95 px-5 pb-[calc(8px+var(--safe-bottom))] pt-3">
        <Button variant="danger" size="icon" className="size-14" aria-label="Maçı sil" onClick={() => setConfirm(true)}>
          <Trash2 className="size-5" />
        </Button>
        <Button variant="primary" size="lg" className="flex-1" onClick={save}>
          Kaydet
        </Button>
      </div>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Maç silinsin mi?"
        description="Bu maç ve istatistiklere katkısı kalıcı olarak silinecek."
        confirmLabel="Sil"
        destructive
        onConfirm={() => {
          deleteMatch(match.id);
          toast("Maç silindi", "info");
          onClose();
        }}
      />
    </div>
  );
}

function StatsTable() {
  const players = useKarma((s) => s.players);
  const matches = useKarma((s) => s.matches);
  const [sort, setSort] = useState<"rate" | "played" | "mvp">("rate");
  const stats = useMemo(() => allPlayerStats(players.map((p) => p.id), matches), [players, matches]);
  const rows = players
    .map((p) => ({ p, s: stats.get(p.id)! }))
    .filter((r) => r.s.played > 0 || r.s.pending > 0)
    .sort((x, y) => {
      if (sort === "played") return y.s.played - x.s.played || (y.s.winRate ?? -1) - (x.s.winRate ?? -1);
      if (sort === "mvp") return y.s.mvps - x.s.mvps || y.s.played - x.s.played;
      return (y.s.winRate ?? -1) - (x.s.winRate ?? -1) || y.s.played - x.s.played;
    });

  if (rows.length === 0) return <p className="py-10 text-center text-sm text-ink-muted">Skoru girilmiş maç olunca istatistikler burada görünür.</p>;

  return (
    <div className="mt-4">
      <Segmented
        size="sm"
        label="Sıralama"
        value={sort}
        onChange={setSort}
        options={[
          { value: "rate", label: "Galibiyet %" },
          { value: "played", label: "Maç" },
          { value: "mvp", label: "MVP" },
        ]}
      />
      <div className="surface mt-3 overflow-x-auto rounded-3xl">
        <table className="w-full text-sm">
          <caption className="sr-only">Oyuncu istatistikleri</caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ink-muted">
              <th scope="col" className="px-2 py-3 font-semibold">
                Oyuncu
              </th>
              <th scope="col" className="px-1 py-3 text-center font-semibold">
                M
              </th>
              <th scope="col" className="px-1 py-3 text-center font-semibold">
                G-B-M
              </th>
              <th scope="col" className="px-1 py-3 text-center font-semibold">
                %
              </th>
              <th scope="col" className="px-1 py-3 text-center font-semibold">
                <Star className="mx-auto size-3.5" aria-label="Maçın adamı" />
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Form
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, s }, i) => (
              <tr key={p.id} className="border-t border-white/5">
                <th scope="row" className="px-2 py-2 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-xs text-ink-faint tabular">{i + 1}</span>
                    <PlayerAvatar avatar={p.avatar} size={24} />
                    <span className="max-w-[72px] truncate font-medium">{p.name.split(" ")[0]}</span>
                  </span>
                </th>
                <td className="px-1 py-2 text-center tabular">{s.played}</td>
                <td className="px-1 py-2 text-center tabular text-ink-soft">
                  {s.wins}-{s.draws}-{s.losses}
                </td>
                <td className="px-1 py-2 text-center font-display text-base font-bold tabular">{s.winRate === null ? "–" : s.winRate}</td>
                <td className="px-1 py-2 text-center tabular">{s.mvps || ""}</td>
                <td className="py-2 pl-1 pr-2">
                  <span className="flex gap-0.5">
                    {s.form.length ? s.form.map((f) => <ResultDot key={f.matchId} result={f.result} small />) : <span className="text-ink-faint">–</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-muted">Form: eskiden yeniye son 5 maç (G galibiyet, B beraberlik, M mağlubiyet).</p>
    </div>
  );
}
