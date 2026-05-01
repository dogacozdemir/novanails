"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      expand={false}
      richColors
      closeButton
      toastOptions={{
        duration: 5200,
        classNames: {
          toast:
            "liquid-glass-v2 shadow-diffuse items-start gap-3 rounded-[1.25rem] border border-white/45 px-4 py-3 font-sans backdrop-blur-xl dark:border-white/15",
          title:
            "font-semibold tracking-tight text-[var(--nova-charcoal)] dark:text-foreground",
          description:
            "text-[13px] leading-snug text-muted-foreground dark:text-muted-foreground",
          closeButton:
            "rounded-lg border border-black/[0.06] bg-white/40 hover:bg-white/60 dark:border-white/12 dark:bg-white/[0.08]",
          success: "border-emerald-400/35",
          error: "border-red-400/30",
        },
      }}
    />
  );
}
