"use client";

import { Link2Off, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import { overallRating } from "@/lib/scoring";
import { decodeShare, KarmaImportError, type SharePayload } from "@/lib/storage";
import { useKarma } from "@/lib/store";
import { Wordmark } from "../logo";
import { PlayerAvatar, PositionBadge, RatingPill } from "../player/bits";
import { Button } from "../ui/button";
import { toast } from "../ui/toast";

export function ShareImportScreen() {
  const router = useRouter();
  const current = useKarma((s) => s.players);
  const weights = useKarma((s) => s.settings.weights);
  const mergeIncoming = useKarma((s) => s.mergeIncoming);
  const setWeights = useKarma((s) => s.setWeights);
  const replaceData = useKarma((s) => s.replaceData);
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPayload(decodeShare(window.location.hash));
    } catch (e) {
      setError(e instanceof KarmaImportError ? e.message : "Link açılamadı.");
    }
  }, []);

  const finish = (message: string) => {
    toast(message);
    // Hash'i temizle (geri tuşuyla tekrar içe aktarılmasın)
    history.replaceState(null, "", withBase("/paylas"));
    router.replace("/oyuncular");
  };

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <Link2Off className="size-12 text-warning" aria-hidden="true" />
        <h1 className="font-display text-3xl font-bold uppercase">Link açılamadı</h1>
        <p className="text-sm text-ink-muted">{error}</p>
        <Link href="/oyuncular" className="inline-flex min-h-12 items-center rounded-2xl bg-pitch-700 px-5 font-medium">
          Uygulamaya git
        </Link>
      </main>
    );
  }
  if (!payload) return null;

  const existing = new Set(current.map((p) => p.id));
  const fresh = payload.players.filter((p) => !existing.has(p.id)).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(24px+var(--safe-bottom))] pt-[calc(var(--safe-top)+24px)]">
      <Wordmark />
      <h1 className="mt-6 font-display text-[34px] font-extrabold uppercase leading-none">Sana bir grup gönderildi</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {payload.players.length} oyuncu
        {payload.matches.length > 0 && ` · ${payload.matches.length} maç`}
        {payload.weights && " · mevki ağırlıkları"}
        {current.length > 0 && ` · ${fresh} yeni, ${payload.players.length - fresh} güncelleme`}
      </p>
      <ul className="surface mt-5 max-h-[45dvh] divide-y divide-white/5 overflow-y-auto rounded-3xl">
        {payload.players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2">
            <PlayerAvatar avatar={p.avatar} size={34} />
            <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            <PositionBadge position={p.primaryPosition} size="sm" />
            <RatingPill value={overallRating(p, payload.weights ?? weights)} />
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-3 pt-6">
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            mergeIncoming({ players: payload.players, matches: payload.matches });
            if (payload.weights) setWeights(payload.weights);
            finish(current.length ? "Grup birleştirildi" : `${payload.players.length} oyuncu eklendi`);
          }}
        >
          <Users className="size-5" aria-hidden="true" /> {current.length ? "Grubuma ekle / güncelle" : "Grubu ekle"}
        </Button>
        {current.length > 0 && (
          <Button
            size="lg"
            variant="danger"
            onClick={() => {
              const s = useKarma.getState();
              replaceData({
                version: s.version,
                players: payload.players,
                matches: payload.matches,
                settings: payload.weights ? { ...s.settings, weights: payload.weights } : s.settings,
                builder: { ...s.builder, selectedIds: [], knownIds: [], benchIds: [], constraints: [] },
              });
              finish("Grup değiştirildi");
            }}
          >
            Mevcut grubumu bununla değiştir
          </Button>
        )}
        <Link href="/oyuncular" className="py-2 text-center text-sm text-ink-muted underline-offset-4 hover:underline">
          Vazgeç
        </Link>
      </div>
    </main>
  );
}
