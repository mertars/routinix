"use client";

import { Link2, MapPin, Plus, Swords, X } from "lucide-react";
import { useState } from "react";
import { POSITION_LABELS } from "@/lib/constants";
import { createId } from "@/lib/ids";
import { POSITIONS, type Constraint, type Player, type Position } from "@/lib/types";
import { PlayerAvatar, PositionBadge } from "../player/bits";
import { Button } from "../ui/button";
import { Segmented } from "../ui/controls";
import { Sheet } from "../ui/sheet";

const TYPE_META = {
  together: { label: "Aynı takım", icon: Link2 },
  apart: { label: "Ayrı takım", icon: Swords },
  position: { label: "Sabit mevki", icon: MapPin },
} as const;

export function describeConstraint(c: Constraint, players: Map<string, Player>): string {
  const n = (id: string) => players.get(id)?.name.split(" ")[0] ?? "?";
  if (c.type === "together") return `${n(c.a)} ve ${n(c.b)} aynı takımda`;
  if (c.type === "apart") return `${n(c.a)} ve ${n(c.b)} ayrı takımlarda`;
  return `${n(c.playerId)} ${POSITION_LABELS[c.position].toLocaleLowerCase("tr")} oynasın`;
}

interface ConstraintsEditorProps {
  constraints: Constraint[];
  players: Player[];
  playerMap: Map<string, Player>;
  onChange: (c: Constraint[]) => void;
  violated?: string[];
}

export function ConstraintsEditor({ constraints, players, playerMap, onChange, violated = [] }: ConstraintsEditorProps) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      {constraints.length === 0 ? (
        <p className="text-sm text-ink-muted">İstersen “bu ikisi aynı takımda olsun” gibi kurallar ekle. Karma bunlara uyarak dengeler.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {constraints.map((c) => {
            const Icon = TYPE_META[c.type].icon;
            const bad = violated.includes(c.id);
            return (
              <li key={c.id} className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 ${bad ? "bg-danger/10 ring-1 ring-danger/40" : "bg-white/4"}`}>
                <Icon className="size-4 shrink-0 text-neon" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-sm">
                  {describeConstraint(c, playerMap)}
                  {bad && <span className="ml-1 text-xs text-danger">(karşılanamadı)</span>}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(constraints.filter((x) => x.id !== c.id))}
                  className="grid size-10 place-items-center rounded-xl text-ink-muted hover:bg-white/5"
                  aria-label={`Kuralı sil: ${describeConstraint(c, playerMap)}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="outline" className="mt-3 w-full" onClick={() => setAdding(true)} disabled={players.length < 2}>
        <Plus className="size-4" aria-hidden="true" /> Kural ekle
      </Button>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Kural ekle" full>
        {adding && (
          <AddConstraint
            players={players}
            onAdd={(c) => {
              onChange([...constraints, c]);
              setAdding(false);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function AddConstraint({ players, onAdd }: { players: Player[]; onAdd: (c: Constraint) => void }) {
  const [type, setType] = useState<Constraint["type"]>("together");
  const [picked, setPicked] = useState<string[]>([]);
  const [position, setPosition] = useState<Position>("DEF");
  const need = type === "position" ? 1 : 2;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(need === 1 ? 1 : p.length >= 2 ? 1 : 0), id]));

  const ready = picked.length === need;
  const submit = () => {
    if (!ready) return;
    const id = createId("c");
    if (type === "position") onAdd({ id, type, playerId: picked[0], position });
    else onAdd({ id, type, a: picked[0], b: picked[1] });
  };

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Kural türü"
        value={type}
        onChange={(t) => {
          setType(t);
          setPicked((p) => p.slice(0, t === "position" ? 1 : 2));
        }}
        options={(Object.keys(TYPE_META) as Constraint["type"][]).map((k) => ({ value: k, label: TYPE_META[k].label }))}
      />
      {type === "position" && (
        <Segmented
          label="Mevki"
          value={position}
          onChange={setPosition}
          options={POSITIONS.map((p) => ({ value: p, label: p, ariaLabel: POSITION_LABELS[p] }))}
        />
      )}
      <p className="text-sm text-ink-muted">
        {type === "position" ? "Bir oyuncu seç." : "İki oyuncu seç."} ({picked.length}/{need})
      </p>
      <ul className="grid grid-cols-1 gap-1.5 pb-24">
        {players.map((p) => {
          const on = picked.includes(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3 text-left ${on ? "border-neon bg-neon/10" : "border-transparent bg-white/4"}`}
              >
                <PlayerAvatar avatar={p.avatar} size={32} />
                <span className="flex-1 truncate font-medium">{p.name}</span>
                <PositionBadge position={p.primaryPosition} size="sm" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-0 -mx-5 border-t border-white/6 bg-pitch-900/95 px-5 pb-[calc(8px+var(--safe-bottom))] pt-3">
        <Button variant="primary" size="lg" className="w-full" disabled={!ready} onClick={submit}>
          Kuralı ekle
        </Button>
      </div>
    </div>
  );
}
