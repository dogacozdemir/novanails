"use client";

import WifiOff from "lucide-react/dist/esm/icons/wifi-off.mjs";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-[55]",
        "md:bottom-6 md:left-auto md:right-6 md:w-full md:max-w-md md:inset-x-auto"
      )}
    >
      <div
        className={cn(
          "glass-nav flex items-start gap-3 rounded-2xl border border-amber-500/35 px-4 py-3 shadow-lg",
          "bg-white/85 backdrop-blur-md dark:bg-zinc-950/85"
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
          <WifiOff className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-foreground">Çevrimdışı mod</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Bağlantı yok; bazı veriler görünmeyebilir. Yeniden bağlanınca sayfayı
            yenileyin.
          </p>
        </div>
      </div>
    </div>
  );
}
