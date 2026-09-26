"use client";

import { toPng } from "html-to-image";

/** DOM düğümünü PNG'ye çevirir; mobilde sistem paylaşımı, masaüstünde indirme. */
export async function exportNodeAsPng(node: HTMLElement, fileName: string): Promise<"shared" | "downloaded"> {
  const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: "#050d09", cacheBust: true });
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], fileName, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Karma kadro" });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
    }
  }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return "downloaded";
}
