import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** Liquid Glass tarzı iskelet — yükleme durumları için */
export function GlassSkeleton({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl border border-[rgba(255,255,255,0.35)] bg-white/40 shadow-diffuse backdrop-blur-xl dark:bg-zinc-900/45",
        className
      )}
      {...rest}
    />
  );
}

export function AppointmentBoardSkeleton() {
  const shellMin = "min-h-[min(72vh,44rem)]";
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 md:pb-16 lg:px-8">
      <div className="mb-8 space-y-3">
        <GlassSkeleton className="h-6 w-40" />
        <GlassSkeleton className="h-10 w-full max-w-md" />
      </div>
      <div
        className={cn(
          "liquid-glass-v2 overflow-hidden rounded-[1.75rem] p-4 shadow-diffuse",
          shellMin
        )}
      >
        <div className="mb-4 flex min-h-[min(72vh,44rem)] gap-2 overflow-hidden">
          <GlassSkeleton className="h-full min-h-[min(72vh,44rem)] min-w-[3.5rem] shrink-0" />
          {[0, 1, 2].map((i) => (
            <GlassSkeleton
              key={i}
              className="h-full min-h-[min(72vh,44rem)] min-w-[11rem] flex-1"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
