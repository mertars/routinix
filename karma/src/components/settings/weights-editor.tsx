"use client";

import { RotateCcw, Wand2 } from "lucide-react";
import { useState } from "react";
import { DEFAULT_WEIGHTS, GK_ATTR_LABELS, MAIN_ATTR_LABELS, POSITION_LABELS } from "@/lib/constants";
import { normalizeWeights, positionRating, weightTotal } from "@/lib/scoring";
import { useKarma } from "@/lib/store";
import { GK_ATTRS, MAIN_ATTRS, type Weights } from "@/lib/types";
import { Button } from "../ui/button";
import { AttributeSlider, Segmented } from "../ui/controls";
import { ConfirmSheet } from "../ui/confirm";
import { toast } from "../ui/toast";

type Tab = "DEF" | "OS" | "KNT" | "FV" | "KL";
const TABS: Tab[] = ["DEF", "OS", "KNT", "FV", "KL"];

function setTotal(w: Weights, tab: Tab): number {
  return tab === "KL" ? weightTotal(w.KL) : weightTotal(w[tab]);
}

export function WeightsEditor() {
  const stored = useKarma((s) => s.settings.weights);
  const setWeights = useKarma((s) => s.setWeights);
  const players = useKarma((s) => s.players);
  const [draft, setDraft] = useState<Weights>(() => structuredClone(stored));
  const [tab, setTab] = useState<Tab>("DEF");
  const [confirmReset, setConfirmReset] = useState(false);

  const invalid = TABS.filter((t) => setTotal(draft, t) !== 100);
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const total = setTotal(draft, tab);

  // Bu sekmedeki ağırlık değişikliğinden en çok etkilenen oyuncular (önizleme)
  const preview = players
    .filter((p) => (tab === "KL" ? p.primaryPosition === "KL" : p.primaryPosition === tab))
    .slice(0, 4)
    .map((p) => ({ p, before: positionRating(p, tab, stored), after: invalid.includes(tab) ? null : positionRating(p, tab, draft) }));

  const update = (key: string, value: number) =>
    setDraft((d) => {
      const next = structuredClone(d);
      if (tab === "KL") next.KL[key as keyof Weights["KL"]] = value;
      else next[tab][key as keyof Weights["DEF"]] = value;
      return next;
    });

  const normalize = () =>
    setDraft((d) => {
      const next = structuredClone(d);
      if (tab === "KL") next.KL = normalizeWeights(next.KL);
      else next[tab] = normalizeWeights(next[tab]);
      return next;
    });

  return (
    <div>
      <Segmented label="Mevki" value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t, label: t, ariaLabel: POSITION_LABELS[t] }))} />
      <div className="mt-3 flex items-center gap-3" aria-live="polite">
        <div className="flex-1">
          <div className="text-sm text-ink-soft">{POSITION_LABELS[tab]} ağırlıkları</div>
          <div className={`text-xs ${total === 100 ? "text-neon" : "text-warning"}`}>
            Toplam {total}/100 {total === 100 ? "✓" : total > 100 ? `(${total - 100} fazla)` : `(${100 - total} eksik)`}
          </div>
        </div>
        {total !== 100 && (
          <Button size="sm" variant="outline" onClick={normalize}>
            <Wand2 className="size-4" aria-hidden="true" /> 100&apos;e tamamla
          </Button>
        )}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8" aria-hidden="true">
        <div className={`h-full rounded-full transition-all ${total === 100 ? "bg-neon" : "bg-warning"}`} style={{ width: `${Math.min(100, total)}%` }} />
      </div>

      <div className="mt-2">
        {tab === "KL"
          ? GK_ATTRS.map((k) => (
              <AttributeSlider key={k} label={GK_ATTR_LABELS[k]} value={draft.KL[k]} min={0} max={100} color="var(--color-neon)" onChange={(v) => update(k, v)} />
            ))
          : MAIN_ATTRS.map((k) => (
              <AttributeSlider key={k} label={MAIN_ATTR_LABELS[k]} value={draft[tab][k]} min={0} max={100} color="var(--color-neon)" onChange={(v) => update(k, v)} />
            ))}
        {tab === "KL" && (
          <div className="mt-2 border-t border-white/5 pt-2">
            <AttributeSlider
              label="PAS etkisi (ayakla oyun)"
              hint="%"
              value={draft.klPassShare}
              min={0}
              max={50}
              color="var(--color-info)"
              onChange={(v) => setDraft((d) => ({ ...d, klPassShare: v }))}
            />
            <p className="text-xs text-ink-muted">KL puanı = kalecilik ortalaması × %{100 - draft.klPassShare} + PAS × %{draft.klPassShare}</p>
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div className="mt-3 rounded-2xl bg-white/4 p-3">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Önizleme</div>
          <ul className="flex flex-col gap-1 text-sm">
            {preview.map(({ p, before, after }) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="flex-1 truncate">{p.name}</span>
                <span className="tabular text-ink-muted">{before}</span>
                <span className="text-ink-faint" aria-hidden="true">→</span>
                <span className={`font-display text-base font-bold tabular ${after !== null && after !== before ? "text-neon" : ""}`}>{after ?? "–"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {invalid.length > 0 && (
        <p className="mt-3 text-xs text-warning">Kaydetmek için şu setlerin toplamı 100 olmalı: {invalid.join(", ")}</p>
      )}
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
        <Button onClick={() => setConfirmReset(true)} aria-label="Varsayılana dön">
          <RotateCcw className="size-4" aria-hidden="true" /> Varsayılan
        </Button>
        <Button
          variant="primary"
          disabled={!dirty || invalid.length > 0}
          onClick={() => {
            setWeights(draft);
            toast("Ağırlıklar kaydedildi · tüm puanlar güncellendi");
          }}
        >
          {dirty ? "Ağırlıkları kaydet" : "Kaydedildi"}
        </Button>
      </div>
      <ConfirmSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Varsayılana dönülsün mü?"
        description="Tüm mevki ağırlıkları ilk hâline döner. Oyuncu özellikleri değişmez, yalnızca puanlar yeniden hesaplanır."
        confirmLabel="Varsayılana dön"
        onConfirm={() => {
          setDraft(structuredClone(DEFAULT_WEIGHTS));
          setWeights(structuredClone(DEFAULT_WEIGHTS));
          toast("Varsayılan ağırlıklar yüklendi", "info");
        }}
      />
    </div>
  );
}
