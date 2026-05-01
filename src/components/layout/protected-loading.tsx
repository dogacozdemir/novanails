import Image from "next/image";

/**
 * Korunan segmentler yüklenirken içerik flash’ını önlemek için — bej zemin + logo.
 */
export function ProtectedLoading() {
  return (
    <div
      className="flex min-h-[calc(100dvh-12rem)] w-full flex-col items-center justify-center bg-[#F5F1E9] px-6 pt-8 dark:bg-background"
      aria-busy
      aria-label="Yükleniyor"
    >
      <div className="relative flex size-24 items-center justify-center">
        <span
          className="absolute inset-0 animate-pulse rounded-[1.5rem] bg-white/35 blur-xl dark:bg-white/[0.06]"
          aria-hidden
        />
        <Image
          src="/logo-mark.svg"
          alt=""
          width={72}
          height={72}
          className="relative size-[4.5rem] animate-nova-pulse object-contain opacity-95"
          priority
        />
      </div>
      <p className="mt-8 font-sans text-xs font-medium tracking-[0.2em] text-muted-foreground">
        Yükleniyor…
      </p>
    </div>
  );
}
