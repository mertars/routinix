import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="font-display text-7xl font-extrabold text-neon">404</div>
      <h1 className="font-display text-3xl font-bold uppercase">Top taca çıktı</h1>
      <p className="text-sm text-ink-muted">Aradığın sayfa bulunamadı.</p>
      <Link href="/oyuncular" className="inline-flex min-h-12 items-center rounded-2xl bg-neon px-6 font-semibold text-on-neon">
        Oyunculara dön
      </Link>
    </main>
  );
}
