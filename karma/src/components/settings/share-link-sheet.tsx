"use client";

import { Copy, Link2, MessageCircle, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { withBase } from "@/lib/base-path";
import { encodeShare } from "@/lib/storage";
import { useKarma } from "@/lib/store";
import { copyText } from "../builder/share-sheet";
import { Button } from "../ui/button";
import { Toggle } from "../ui/controls";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

export function ShareLinkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const players = useKarma((s) => s.players);
  const matches = useKarma((s) => s.matches);
  const settings = useKarma((s) => s.settings);
  const [includeMatches, setIncludeMatches] = useState(false);
  const [includeWeights, setIncludeWeights] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(false);
  const hasPhotos = players.some((p) => p.avatar.type === "photo");

  const url = useMemo(() => {
    if (!open || typeof window === "undefined") return "";
    const code = encodeShare({ players, matches, settings }, { includeMatches, includeWeights, includePhotos });
    return `${window.location.origin}${withBase("/paylas")}#${code}`;
  }, [open, players, matches, settings, includeMatches, includeWeights, includePhotos]);

  const message = `⚽ Karma halısaha grubumuz (${players.length} oyuncu). Açınca kendi telefonuna ekleyebilirsin:\n${url}`;
  const tooLong = url.length > 30000;

  return (
    <Sheet open={open} onClose={onClose} title="Grubu paylaş">
      <div className="flex flex-col gap-4 pb-[var(--safe-bottom)]">
        <p className="text-sm leading-relaxed text-ink-soft">
          Tüm oyuncular sıkıştırılıp linkin içine konur; sunucuya hiçbir şey gönderilmez. Linki açan kişi grubu kendi cihazına ekleyebilir.
        </p>
        <div className="surface rounded-2xl px-4">
          <Toggle checked={includeWeights} onChange={setIncludeWeights} label="Mevki ağırlıklarını ekle" />
          <Toggle checked={includeMatches} onChange={setIncludeMatches} label={`Maç geçmişini ekle (${matches.length})`} description="Link uzar." />
          {hasPhotos && (
            <Toggle checked={includePhotos} onChange={setIncludePhotos} label="Fotoğrafları ekle" description="Link çok uzar; bazı uygulamalar kesebilir." />
          )}
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white/4 px-3 py-2.5 text-xs text-ink-muted">
          <Link2 className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-mono">{url}</span>
          <span className="shrink-0 tabular">{(url.length / 1000).toFixed(1)}k</span>
        </div>
        {tooLong && <p className="text-xs text-warning">Link çok uzun; fotoğrafları veya maç geçmişini çıkarmayı deneyin ya da JSON yedeği kullanın.</p>}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-[#25d366] px-6 text-base font-semibold text-[#04150a]"
        >
          <MessageCircle className="size-5" aria-hidden="true" /> WhatsApp&apos;ta gönder
        </a>
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" onClick={async () => toast((await copyText(url)) ? "Link kopyalandı" : "Kopyalanamadı", "info")}>
            <Copy className="size-5" aria-hidden="true" /> Kopyala
          </Button>
          <Button
            size="lg"
            onClick={() => {
              if ("share" in navigator) navigator.share({ title: "Karma grubu", text: message }).catch(() => {});
              else void copyText(url).then(() => toast("Link kopyalandı", "info"));
            }}
          >
            <Share2 className="size-5" aria-hidden="true" /> Paylaş
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
