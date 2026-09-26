"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, LayoutGrid, List, Plus, Search, Sparkles, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { POSITION_LABELS } from "@/lib/constants";
import { overallRating } from "@/lib/scoring";
import { useKarma } from "@/lib/store";
import { POSITIONS, type Player, type Position } from "@/lib/types";
import { EmptyState } from "../empty-state";
import { PageHeader } from "../page-header";
import { PlayerAvatar, PositionBadge, RatingPill } from "../player/bits";
import { PlayerCard } from "../player/player-card";
import { PlayerEditor } from "../player/player-editor";
import { PlayerProfile } from "../player/player-profile";
import { Button } from "../ui/button";
import { Chip } from "../ui/controls";
import { toast } from "../ui/toast";

type SortKey = "rating" | "name" | "position";
type View = "grid" | "list";

function readPref<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

export function PlayersScreen() {
  const players = useKarma((s) => s.players);
  const weights = useKarma((s) => s.settings.weights);
  const loadSample = useKarma((s) => s.loadSample);
  const toggleActive = useKarma((s) => s.toggleActive);
  const setAllActive = useKarma((s) => s.setAllActive);

  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<Position | "all">("all");
  const [sort, setSort] = useState<SortKey>("rating");
  const [view, setView] = useState<View>(() => readPref("karma:view", "grid"));
  const [profile, setProfile] = useState<Player | null>(null);
  const [editing, setEditing] = useState<Player | "new" | null>(null);

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem("karma:view", v);
    } catch {}
  };

  const rated = useMemo(() => players.map((p) => ({ p, r: overallRating(p, weights) })), [players, weights]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return rated
      .filter(({ p }) => position === "all" || p.primaryPosition === position || p.altPositions.includes(position))
      .filter(({ p }) => !q || p.name.toLocaleLowerCase("tr").includes(q) || p.nickname?.toLocaleLowerCase("tr").includes(q))
      .sort((a, b) => {
        if (sort === "name") return a.p.name.localeCompare(b.p.name, "tr");
        if (sort === "position") return POSITIONS.indexOf(a.p.primaryPosition) - POSITIONS.indexOf(b.p.primaryPosition) || b.r - a.r;
        return b.r - a.r;
      });
  }, [rated, query, position, sort]);

  const activeCount = players.filter((p) => p.active).length;

  if (players.length === 0) {
    return (
      <main className="pb-nav">
        <PageHeader title="Oyuncular" eyebrow="Karma" subtitle="Grubunu kur, gerisini Karma halletsin." />
        <EmptyState
          title="Kadro bomboş"
          description="Oyuncularını ekle; her birinin hız, şut, pas gibi özelliklerini gir. Karma mevkiye göre puanlayıp en dengeli iki takımı kursun."
        >
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
          <Button size="lg" onClick={() => setEditing("new")}>
            <UserPlus className="size-5" aria-hidden="true" /> İlk oyuncuyu ekle
          </Button>
        </EmptyState>
        <PlayerEditor target={editing} onClose={() => setEditing(null)} />
      </main>
    );
  }

  return (
    <main className="pb-[calc(var(--nav-height)+var(--safe-bottom)+96px)]">
      <PageHeader
        title="Oyuncular"
        eyebrow="Karma"
        subtitle={
          <>
            {players.length} oyuncu · <span className="text-neon">{activeCount} bu hafta geliyor</span>
          </>
        }
        actions={
          <div className="flex rounded-2xl bg-pitch-800 p-1" role="group" aria-label="Görünüm">
            <button
              type="button"
              aria-pressed={view === "grid"}
              aria-label="Kart görünümü"
              onClick={() => changeView("grid")}
              className={`grid size-10 place-items-center rounded-xl ${view === "grid" ? "bg-pitch-600 text-ink" : "text-ink-muted"}`}
            >
              <LayoutGrid className="size-5" />
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              aria-label="Liste görünümü"
              onClick={() => changeView("list")}
              className={`grid size-10 place-items-center rounded-xl ${view === "list" ? "bg-pitch-600 text-ink" : "text-ink-muted"}`}
            >
              <List className="size-5" />
            </button>
          </div>
        }
      />

      <div className="sticky top-0 z-20 -mt-1 space-y-2.5 bg-gradient-to-b from-pitch-950 via-pitch-950/95 to-pitch-950/0 px-4 pb-3 pt-2">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Oyuncu ara"
              aria-label="Oyuncu ara"
              className="h-12 w-full rounded-2xl border border-white/8 bg-pitch-850 pl-12 pr-4 text-[16px] outline-none placeholder:text-ink-faint focus:border-neon"
            />
          </div>
          <label className="relative shrink-0">
            <span className="sr-only">Sırala</span>
            <ArrowDownUp className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-12 appearance-none rounded-2xl border border-white/8 bg-pitch-850 pl-10 pr-3 text-sm font-semibold text-ink-soft outline-none focus:border-neon"
            >
              <option value="rating">Puan</option>
              <option value="name">İsim</option>
              <option value="position">Mevki</option>
            </select>
          </label>
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Mevkiye göre filtrele">
          <Chip active={position === "all"} onClick={() => setPosition("all")}>
            Tümü
          </Chip>
          {POSITIONS.map((p) => (
            <Chip key={p} active={position === p} onClick={() => setPosition(p)} ariaLabel={POSITION_LABELS[p]}>
              {p}
            </Chip>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-ink-muted">Aramana uyan oyuncu yok.</p>
      ) : view === "grid" ? (
        <motion.ul layout className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <AnimatePresence initial>
            {visible.map(({ p, r }, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: Math.min(i, 12) * 0.035 } }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <button
                  type="button"
                  onClick={() => setProfile(p)}
                  className="block w-full rounded-[18px] transition-transform active:scale-[0.97]"
                  aria-label={`${p.name} profilini aç`}
                >
                  <PlayerCard player={p} weights={weights} rating={r} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      ) : (
        <div className="px-4">
          <div className="mb-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAllActive(true)}>
              Hepsi geliyor
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAllActive(false)}>
              Hepsini pasif yap
            </Button>
          </div>
          <ul className="surface divide-y divide-white/5 overflow-hidden rounded-3xl">
            {visible.map(({ p, r }) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <button type="button" onClick={() => setProfile(p)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${p.name} profilini aç`}>
                  <PlayerAvatar avatar={p.avatar} size={40} className={p.active ? "" : "opacity-50 grayscale"} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-semibold ${p.active ? "" : "text-ink-muted"}`}>{p.name}</span>
                    <span className="mt-0.5 flex items-center gap-1">
                      <PositionBadge position={p.primaryPosition} size="sm" />
                      {p.altPositions.map((a) => (
                        <PositionBadge key={a} position={a} size="sm" variant="outline" />
                      ))}
                    </span>
                  </span>
                  <RatingPill value={r} />
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={p.active}
                  aria-label={`${p.name} bu hafta geliyor`}
                  onClick={() => toggleActive(p.id)}
                  className="grid size-11 place-items-center"
                >
                  <span className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${p.active ? "bg-neon" : "bg-pitch-600"}`}>
                    <span className={`absolute size-5 rounded-full bg-white shadow transition-transform ${p.active ? "translate-x-6" : "translate-x-1"}`} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <motion.div className="fixed bottom-nav right-4 z-30 md:right-[max(1rem,calc(50%-30rem))]" initial={{ scale: 0 }} animate={{ scale: 1 }}>
        <Button variant="primary" size="lg" className="rounded-full px-5 shadow-glow" onClick={() => setEditing("new")}>
          <Plus className="size-5" aria-hidden="true" /> Oyuncu ekle
        </Button>
      </motion.div>

      <PlayerProfile
        player={profile}
        onClose={() => setProfile(null)}
        onEdit={(p) => {
          setProfile(null);
          setEditing(p);
        }}
      />
      <PlayerEditor target={editing} onClose={() => setEditing(null)} />
    </main>
  );
}
