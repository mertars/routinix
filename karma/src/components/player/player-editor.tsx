"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, ChevronDown, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  ATTR_GROUPS,
  AVATAR_EMOJIS,
  FOOT_LABELS,
  GK_ATTR_LABELS,
  MAIN_ATTR_LABELS,
  POSITION_COLORS,
  POSITION_LABELS,
  SUB_ATTR_LABELS,
} from "@/lib/constants";
import { resizeImageToDataUrl } from "@/lib/image";
import {
  allPositionRatings,
  canKeep,
  defaultSubAttributes,
  estimateGoalkeeping,
  goalkeepingFromValue,
  mainAttributes,
  overallRating,
  suggestPosition,
} from "@/lib/scoring";
import { useKarma, type PlayerInput } from "@/lib/store";
import { GK_ATTRS, MAIN_ATTRS, POSITIONS, type Foot, type Player, type Position } from "@/lib/types";
import { Button } from "../ui/button";
import { ConfirmSheet } from "../ui/confirm";
import { AttributeSlider, Segmented, Toggle } from "../ui/controls";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { PlayerAvatar } from "./bits";
import { PlayerCard } from "./player-card";

function emptyDraft(): PlayerInput {
  return {
    name: "",
    nickname: undefined,
    avatar: { type: "emoji", value: AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)] },
    primaryPosition: "OS",
    altPositions: [],
    foot: "sag",
    active: true,
    attributes: defaultSubAttributes(60),
    goalkeeping: undefined,
    inputMode: "quick",
  };
}

function toDraft(p: Player): PlayerInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = p;
  return structuredClone(rest);
}

interface PlayerEditorProps {
  /** `null` = kapalı, `"new"` = yeni oyuncu, aksi halde düzenlenen oyuncu. */
  target: Player | "new" | null;
  onClose: () => void;
  onSaved?: (player: Player) => void;
  onDeleted?: () => void;
}

export function PlayerEditor({ target, onClose, onSaved, onDeleted }: PlayerEditorProps) {
  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      full
      title={target === "new" ? "Yeni oyuncu" : target ? "Oyuncuyu düzenle" : ""}
    >
      {target !== null && (
        <EditorBody key={target === "new" ? "new" : target.id} target={target} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />
      )}
    </Sheet>
  );
}

function EditorBody({ target, onClose, onSaved, onDeleted }: { target: Player | "new" } & Omit<PlayerEditorProps, "target">) {
  const weights = useKarma((s) => s.settings.weights);
  const addPlayer = useKarma((s) => s.addPlayer);
  const updatePlayer = useKarma((s) => s.updatePlayer);
  const deletePlayer = useKarma((s) => s.deletePlayer);
  const [draft, setDraft] = useState<PlayerInput>(() => (target === "new" ? emptyDraft() : toDraft(target)));
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(["hiz"]));
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<PlayerInput>) => setDraft((d) => ({ ...d, ...p }));
  const keeper = canKeep(draft);
  const gk = draft.goalkeeping ?? estimateGoalkeeping(draft.attributes);
  const main = mainAttributes(draft.attributes);
  const preview: Player = { ...draft, goalkeeping: keeper ? gk : undefined, id: "preview", createdAt: 0, updatedAt: 0, name: draft.name || "Oyuncu" };
  const ratings = allPositionRatings(preview, weights);
  const suggestion = suggestPosition(preview, weights);

  const setPrimary = (pos: Position) => {
    setDraft((d) => {
      const altPositions = d.altPositions.filter((p) => p !== pos);
      const next = { ...d, primaryPosition: pos, altPositions };
      if (pos === "KL" && !d.goalkeeping) next.goalkeeping = goalkeepingFromValue(65);
      return next;
    });
  };

  const toggleAlt = (pos: Position) => {
    if (pos === draft.primaryPosition) return;
    if (draft.altPositions.includes(pos)) {
      patch({ altPositions: draft.altPositions.filter((p) => p !== pos) });
    } else if (draft.altPositions.length >= 2) {
      toast("En fazla 2 alternatif mevki seçebilirsin.", "info");
    } else {
      patch({
        altPositions: [...draft.altPositions, pos],
        goalkeeping: pos === "KL" && !draft.goalkeeping ? estimateGoalkeeping(draft.attributes) : draft.goalkeeping,
      });
    }
  };

  const setMain = (key: (typeof MAIN_ATTRS)[number], value: number) => {
    const attributes = { ...draft.attributes };
    for (const sub of ATTR_GROUPS[key]) attributes[sub] = value;
    patch({ attributes });
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      patch({ avatar: { type: "photo", dataUrl } });
      setAvatarOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Fotoğraf yüklenemedi.", "error");
    }
  };

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      setNameError(true);
      document.getElementById("player-name")?.focus();
      return;
    }
    const input: PlayerInput = {
      ...draft,
      name,
      nickname: draft.nickname?.trim() || undefined,
      goalkeeping: keeper ? gk : undefined,
    };
    if (target === "new") {
      const created = addPlayer(input);
      toast(`${name} eklendi`);
      onSaved?.(created);
    } else {
      updatePlayer(target.id, input);
      toast("Değişiklikler kaydedildi");
      onSaved?.({ ...target, ...input });
    }
    onClose();
  };

  const toggleGroup = (k: string) =>
    setOpenGroups((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Canlı önizleme */}
      <div className="flex items-center gap-4">
        <PlayerCard player={preview} weights={weights} size="sm" showInactive={false} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Mevki puanları</div>
          <ul className="mt-2 grid grid-cols-1 gap-1.5">
            {POSITIONS.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm">
                <span className="w-9 font-display font-bold" style={{ color: "var(--color-ink)" }}>
                  <span className="mr-1 inline-block size-2 rounded-full" style={{ background: POSITION_COLORS[p] }} aria-hidden="true" />
                  {p}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                  <span className="block h-full rounded-full bg-ink-muted" style={{ width: `${ratings[p]}%`, background: p === suggestion.position ? "var(--color-neon)" : undefined }} />
                </span>
                <span className="w-7 text-right font-display text-base font-bold tabular">{ratings[p]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">
            Önerilen: <strong className="text-neon">{POSITION_LABELS[suggestion.position]}</strong> ({suggestion.rating})
          </p>
        </div>
      </div>

      {/* Kimlik */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setAvatarOpen((o) => !o)}
          className="relative shrink-0 rounded-full"
          aria-label="Avatarı değiştir"
          aria-expanded={avatarOpen}
        >
          <PlayerAvatar avatar={draft.avatar} size={64} />
          <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full bg-neon text-on-neon">
            <Camera className="size-3.5" aria-hidden="true" />
          </span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label className="sr-only" htmlFor="player-name">
            İsim
          </label>
          <input
            id="player-name"
            value={draft.name}
            onChange={(e) => {
              patch({ name: e.target.value });
              if (nameError) setNameError(false);
            }}
            placeholder="İsim Soyisim"
            autoComplete="off"
            maxLength={40}
            aria-invalid={nameError}
            aria-describedby={nameError ? "name-err" : undefined}
            className={`h-12 w-full rounded-2xl border bg-pitch-800 px-4 text-[16px] text-ink outline-none placeholder:text-ink-faint focus:border-neon ${
              nameError ? "border-danger" : "border-white/10"
            }`}
          />
          {nameError && (
            <p id="name-err" className="-mt-1 text-xs text-danger">
              İsim gerekli.
            </p>
          )}
          <label className="sr-only" htmlFor="player-nick">
            Takma ad (opsiyonel)
          </label>
          <input
            id="player-nick"
            value={draft.nickname ?? ""}
            onChange={(e) => patch({ nickname: e.target.value })}
            placeholder="Takma ad (opsiyonel)"
            autoComplete="off"
            maxLength={30}
            className="h-12 w-full rounded-2xl border border-white/10 bg-pitch-800 px-4 text-[16px] text-ink outline-none placeholder:text-ink-faint focus:border-neon"
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {avatarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="-mt-2 overflow-hidden"
          >
            <div className="surface rounded-3xl p-3">
              <div className="grid grid-cols-6 gap-1.5" role="listbox" aria-label="Emoji avatar seç">
                {AVATAR_EMOJIS.map((e) => {
                  const selected = draft.avatar.type === "emoji" && draft.avatar.value === e;
                  return (
                    <button
                      key={e}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-label={`Emoji ${e}`}
                      onClick={() => {
                        patch({ avatar: { type: "emoji", value: e } });
                        setAvatarOpen(false);
                      }}
                      className={`grid aspect-square min-h-11 place-items-center rounded-xl text-2xl ${selected ? "bg-neon/20 ring-2 ring-neon" : "bg-white/5 hover:bg-white/10"}`}
                    >
                      {e}
                    </button>
                  );
                })}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
              <Button className="mt-3 w-full" onClick={() => fileRef.current?.click()}>
                <Camera className="size-4" aria-hidden="true" /> Fotoğraf yükle
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mevki */}
      <div>
        <FieldLabel>Ana mevki</FieldLabel>
        <Segmented
          label="Ana mevki"
          value={draft.primaryPosition}
          onChange={setPrimary}
          options={POSITIONS.map((p) => ({ value: p, label: p, ariaLabel: POSITION_LABELS[p] }))}
        />
      </div>
      <div>
        <FieldLabel hint={`${draft.altPositions.length}/2`}>Alternatif mevkiler</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.filter((p) => p !== draft.primaryPosition).map((p) => {
            const on = draft.altPositions.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => toggleAlt(p)}
                className={`min-h-11 flex-1 rounded-2xl border px-3 text-sm font-semibold transition-colors ${
                  on ? "border-neon bg-neon/15 text-ink" : "border-white/10 bg-pitch-800 text-ink-muted"
                }`}
              >
                <span className="font-display text-base">{p}</span>
                <span className="sr-only"> {POSITION_LABELS[p]}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div>
          <FieldLabel>Tercih ettiği ayak</FieldLabel>
          <Segmented
            label="Tercih ettiği ayak"
            value={draft.foot}
            onChange={(foot: Foot) => patch({ foot })}
            options={(Object.keys(FOOT_LABELS) as Foot[]).map((f) => ({ value: f, label: FOOT_LABELS[f] }))}
          />
        </div>
        <div className="surface rounded-2xl px-4">
          <Toggle
            checked={draft.active}
            onChange={(active) => patch({ active })}
            label="Bu hafta geliyor"
            description="Pasif oyuncular kadro kurulurken varsayılan olarak seçilmez."
          />
        </div>
      </div>

      {/* Özellikler */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <h3 className="flex-1 font-display text-xl font-bold uppercase tracking-wide">Özellikler</h3>
          <Segmented
            size="sm"
            className="w-44"
            label="Giriş modu"
            value={draft.inputMode}
            onChange={(inputMode) => patch({ inputMode })}
            options={[
              { value: "quick", label: "Hızlı" },
              { value: "detailed", label: "Detaylı" },
            ]}
          />
        </div>
        {draft.inputMode === "quick" ? (
          <div className="surface rounded-3xl px-4 py-2">
            {MAIN_ATTRS.map((k) => (
              <AttributeSlider key={k} emphasis label={MAIN_ATTR_LABELS[k]} value={main[k]} onChange={(v) => setMain(k, v)} />
            ))}
            <p className="pb-2 pt-1 text-xs leading-relaxed text-ink-muted">
              Hızlı modda her ana özelliğin alt özellikleri aynı değerle doldurulur. İnce ayar için Detaylı moda geç.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {MAIN_ATTRS.map((k) => {
              const open = openGroups.has(k);
              return (
                <div key={k} className="surface overflow-hidden rounded-3xl">
                  <button
                    type="button"
                    onClick={() => toggleGroup(k)}
                    aria-expanded={open}
                    className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
                  >
                    <span className="flex-1 font-semibold">{MAIN_ATTR_LABELS[k]}</span>
                    <span className="font-display text-2xl font-extrabold tabular">{main[k]}</span>
                    <ChevronDown className={`size-5 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {open && (
                    <div className="border-t border-white/5 px-4 pb-2 pt-1">
                      {ATTR_GROUPS[k].map((sub) => (
                        <AttributeSlider
                          key={sub}
                          label={SUB_ATTR_LABELS[sub]}
                          value={draft.attributes[sub]}
                          onChange={(v) => patch({ attributes: { ...draft.attributes, [sub]: v } })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {keeper && (
        <div>
          <h3 className="mb-2 font-display text-xl font-bold uppercase tracking-wide">Kalecilik</h3>
          <div className="surface rounded-3xl px-4 py-2" style={{ borderColor: `${POSITION_COLORS.KL}55` }}>
            {draft.inputMode === "quick" ? (
              <AttributeSlider
                emphasis
                label="Kalecilik (genel)"
                value={Math.round(GK_ATTRS.reduce((s, k) => s + gk[k], 0) / GK_ATTRS.length)}
                onChange={(v) => patch({ goalkeeping: goalkeepingFromValue(v) })}
              />
            ) : (
              GK_ATTRS.map((k) => (
                <AttributeSlider key={k} label={GK_ATTR_LABELS[k]} value={gk[k]} onChange={(v) => patch({ goalkeeping: { ...gk, [k]: v } })} />
              ))
            )}
            <p className="pb-2 pt-1 text-xs text-ink-muted">
              KL puanı: {ratings.KL} · Kaleci ayakla da oynadığı için sonuca %{weights.klPassShare} PAS etkisi eklenir.
            </p>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 mt-2 flex gap-3 border-t border-white/6 bg-pitch-900/95 px-5 pb-[calc(8px+var(--safe-bottom))] pt-3 backdrop-blur">
        {target !== "new" && (
          <Button variant="danger" size="icon" className="size-14" aria-label="Oyuncuyu sil" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-5" />
          </Button>
        )}
        <Button variant="primary" size="lg" className="flex-1" onClick={save}>
          {target === "new" ? "Oyuncuyu ekle" : "Kaydet"} · {overallRating(preview, weights)}
        </Button>
      </div>

      {target !== "new" && (
        <ConfirmSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Oyuncu silinsin mi?"
          description={`${target.name} kalıcı olarak silinecek. Geçmiş maç kayıtlarındaki adı korunur.`}
          confirmLabel="Sil"
          destructive
          onConfirm={() => {
            deletePlayer(target.id);
            toast(`${target.name} silindi`, "info");
            onDeleted?.();
            onClose();
          }}
        />
      )}
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
      <span>{children}</span>
      {hint && <span className="tabular">{hint}</span>}
    </div>
  );
}
