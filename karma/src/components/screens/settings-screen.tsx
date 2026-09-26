"use client";

import { Database, Download, Link2, Palette, ShieldAlert, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { formationsFor, MATCH_FORMATS } from "@/lib/constants";
import { todayIso } from "@/lib/ids";
import { exportJson, importJson, KarmaImportError } from "@/lib/storage";
import { useKarma } from "@/lib/store";
import type { KarmaData, TeamStyle } from "@/lib/types";
import { FormationThumb } from "../builder/formation-thumb";
import { TeamStyleSheet } from "../builder/team-style-sheet";
import { Wordmark } from "../logo";
import { PageHeader } from "../page-header";
import { ShareLinkSheet } from "../settings/share-link-sheet";
import { WeightsEditor } from "../settings/weights-editor";
import { Button } from "../ui/button";
import { ConfirmSheet } from "../ui/confirm";
import { Section, Segmented } from "../ui/controls";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

export function SettingsScreen() {
  const state = useKarma();
  const { settings, players, matches } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<KarmaData | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [styleTeam, setStyleTeam] = useState<0 | 1 | null>(null);

  const exportFile = () => {
    const json = exportJson({ version: state.version, players, matches, settings, builder: state.builder });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `karma-yedek-${todayIso()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Yedek indirildi");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setIncoming(importJson(await file.text()));
    } catch (e) {
      toast(e instanceof KarmaImportError ? e.message : "Dosya okunamadı.", "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <main className="pb-nav">
      <PageHeader title="Ayarlar" eyebrow="Karma" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4">
        <Section title="Mevki ağırlıkları" subtitle="Genel puan, mevkiye göre 6 ana özelliğin ağırlıklı ortalamasıdır.">
          <WeightsEditor />
        </Section>

        <Section title="Varsayılan maç" subtitle="Kadro kurarken ilk seçili gelen ayarlar.">
          <Segmented
            label="Varsayılan format"
            value={settings.defaultFormat}
            onChange={(f) => state.setDefaultFormat(f)}
            options={MATCH_FORMATS.map((f) => ({ value: f, label: `${f}v${f}` }))}
          />
          <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Varsayılan diziliş">
            {formationsFor(settings.defaultFormat).map((f) => {
              const on = settings.defaultFormations[settings.defaultFormat] === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => state.setDefaultFormation(settings.defaultFormat, f.id)}
                  className={`flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-2 ${on ? "border-neon bg-neon/10" : "border-white/8"}`}
                >
                  <FormationThumb formation={f} className="h-16 w-15" />
                  <span className={`font-display text-base font-bold ${on ? "text-ink" : "text-ink-muted"}`}>{f.name}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {([0, 1] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setStyleTeam(t)}
                className="flex min-h-12 items-center gap-2 rounded-2xl bg-white/4 px-3 text-left"
                aria-label={`Varsayılan takım ${t + 1}: ${settings.teamStyles[t].name}, düzenle`}
              >
                <span className="size-4 shrink-0 rounded-full border border-white/30" style={{ background: settings.teamStyles[t].color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">{settings.teamStyles[t].name}</span>
                <Palette className="size-4 text-ink-muted" aria-hidden="true" />
              </button>
            ))}
          </div>
        </Section>

        <Section title="Veriler ve paylaşım" subtitle={`${players.length} oyuncu · ${matches.length} maç · yalnızca bu cihazda saklanıyor`}>
          <div className="flex flex-col gap-2">
            <Button size="lg" variant="outline" onClick={() => setShareOpen(true)} disabled={players.length === 0}>
              <Link2 className="size-5" aria-hidden="true" /> Grubu link ile paylaş
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" onClick={exportFile}>
                <Download className="size-5" aria-hidden="true" /> JSON dışa aktar
              </Button>
              <Button size="lg" onClick={() => fileRef.current?.click()}>
                <Upload className="size-5" aria-hidden="true" /> JSON içe aktar
              </Button>
            </div>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </Section>

        <Section title="Tehlikeli bölge">
          <Button size="lg" variant="danger" className="w-full" onClick={() => setResetOpen(true)}>
            <ShieldAlert className="size-5" aria-hidden="true" /> Tüm verileri sıfırla
          </Button>
        </Section>

        <div className="flex flex-col items-center gap-2 py-6 text-center text-xs text-ink-faint">
          <Wordmark />
          <p>Halısaha için dengeli takımlar. Veriler cihazında kalır.</p>
        </div>
      </div>

      <ShareLinkSheet open={shareOpen} onClose={() => setShareOpen(false)} />

      <Sheet open={incoming !== null} onClose={() => setIncoming(null)} title="Yedeği içe aktar">
        {incoming && (
          <div className="flex flex-col gap-4 pb-[var(--safe-bottom)]">
            <div className="flex items-center gap-3 rounded-2xl bg-white/4 p-3">
              <Database className="size-5 text-neon" aria-hidden="true" />
              <p className="text-sm">
                Dosyada <strong>{incoming.players.length}</strong> oyuncu ve <strong>{incoming.matches.length}</strong> maç var.
              </p>
            </div>
            <p className="text-sm text-ink-soft">
              <strong>Birleştir:</strong> mevcut verilerin korunur, aynı oyuncunun daha yeni hâli alınır.
              <br />
              <strong>Değiştir:</strong> bu cihazdaki tüm veriler yedektekiyle değiştirilir.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                onClick={() => {
                  state.mergeIncoming(incoming);
                  setIncoming(null);
                  toast("Veriler birleştirildi");
                }}
              >
                Birleştir
              </Button>
              <Button
                size="lg"
                variant="danger"
                onClick={() => {
                  state.replaceData(incoming);
                  setIncoming(null);
                  toast("Yedek geri yüklendi");
                }}
              >
                Değiştir
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Her şey silinsin mi?"
        description={`${players.length} oyuncu, ${matches.length} maç ve tüm ayarlar bu cihazdan kalıcı olarak silinecek. Önce JSON yedeği almanı öneririz.`}
        confirmLabel="Evet, sıfırla"
        destructive
        onConfirm={() => {
          void state.resetAll().then(() => toast("Tüm veriler silindi", "info"));
        }}
      />
      <TeamStyleSheet
        open={styleTeam !== null}
        team={styleTeam ?? 0}
        styles={settings.teamStyles}
        onClose={() => setStyleTeam(null)}
        onSave={(styles: [TeamStyle, TeamStyle]) => {
          state.setDefaultTeamStyles(styles);
          state.updateBuilder({ teamStyles: styles });
        }}
      />
    </main>
  );
}
