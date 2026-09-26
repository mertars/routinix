"use client";

import { Copy, ImageDown, MessageCircle, Share2 } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Evaluation } from "@/lib/balancer";
import { exportNodeAsPng } from "@/lib/export-image";
import { todayIso } from "@/lib/ids";
import type { Lineup, MatchFormat, Player, TeamStyle } from "@/lib/types";
import { Button } from "../ui/button";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { ExportCard } from "./export-card";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  text: string;
  lineup: Lineup;
  evaluation: Evaluation;
  players: Map<string, Player>;
  styles: [TeamStyle, TeamStyle];
  format: MatchFormat;
  rotatingKeeper: boolean;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function ShareSheet({ open, onClose, text, ...exportProps }: ShareSheetProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  const downloadPng = async () => {
    setRendering(true);
    // Görsel düğümünün DOM'a yerleşmesi ve fontların hazır olması için bekle
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await document.fonts?.ready;
    try {
      if (!exportRef.current) throw new Error("no node");
      const how = await exportNodeAsPng(exportRef.current, `karma-kadro-${todayIso()}.png`);
      toast(how === "shared" ? "Görsel paylaşıldı" : "Görsel indirildi");
    } catch {
      toast("Görsel oluşturulamadı", "error");
    } finally {
      setRendering(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Kadroyu paylaş">
      <div className="flex flex-col gap-3 pb-[var(--safe-bottom)]">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-[#25d366] px-6 text-base font-semibold text-[#04150a] active:scale-[0.98]"
        >
          <MessageCircle className="size-5" aria-hidden="true" /> WhatsApp&apos;ta paylaş
        </a>
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            onClick={async () => {
              toast((await copyText(text)) ? "Metin kopyalandı" : "Kopyalanamadı", "info");
            }}
          >
            <Copy className="size-5" aria-hidden="true" /> Kopyala
          </Button>
          <Button size="lg" onClick={downloadPng} disabled={rendering}>
            <ImageDown className="size-5" aria-hidden="true" /> {rendering ? "Hazırlanıyor…" : "PNG indir"}
          </Button>
        </div>
        {canNativeShare && (
          <Button
            size="lg"
            variant="ghost"
            onClick={() => navigator.share({ text }).catch(() => {})}
          >
            <Share2 className="size-5" aria-hidden="true" /> Diğer uygulamalar
          </Button>
        )}
        <details className="rounded-2xl bg-white/4 p-3">
          <summary className="min-h-10 cursor-pointer text-sm font-semibold text-ink-soft">Metin önizlemesi</summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-soft">{text}</pre>
        </details>
      </div>
      {rendering &&
        createPortal(
          <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden="true">
            <ExportCard ref={exportRef} {...exportProps} />
          </div>,
          document.body,
        )}
    </Sheet>
  );
}
