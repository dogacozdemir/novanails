import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] text-center md:pb-16">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 shadow-inner ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
        <span className="font-heading text-2xl text-primary">✶</span>
      </div>
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Çevrimdışısınız
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Bağlantınız kesildi veya bu sayfa henüz önbelleğe alınmadı. İnternet
          bağlantınızı kontrol edip tekrar deneyin.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-glass-inner transition-opacity hover:opacity-95"
      >
        Dashboard’a dön
      </Link>
    </div>
  );
}
