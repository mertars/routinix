"use client";

import { Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** "Ana ekrana ekle" yönlendirmesi: Android'de yükleme istemi, iOS'ta talimat. */
export function InstallCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setStandalone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || (!deferred && !ios)) return null;

  return (
    <div className="surface flex items-start gap-3 rounded-3xl p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-neon/15 text-neon">
        <Smartphone className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Karma&apos;yı telefonuna ekle</p>
        {deferred ? (
          <>
            <p className="mt-0.5 text-sm text-ink-muted">Uygulama gibi tam ekran açılsın, internet olmadan da çalışsın.</p>
            <Button
              variant="primary"
              size="sm"
              className="mt-3"
              onClick={async () => {
                await deferred.prompt();
                await deferred.userChoice;
                setDeferred(null);
              }}
            >
              Ana ekrana ekle
            </Button>
          </>
        ) : (
          <p className="mt-0.5 text-sm text-ink-muted">
            Safari&apos;de alttaki <strong className="text-ink">Paylaş</strong> düğmesine, sonra <strong className="text-ink">Ana Ekrana Ekle</strong>&apos;ye dokun.
          </p>
        )}
      </div>
    </div>
  );
}
