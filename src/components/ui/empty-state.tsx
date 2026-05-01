import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";
import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description?: string;
  className?: string;
  children?: ReactNode;
  /** Logo ile uyumlu Nova parıltı süslemesi */
  novaAccent?: boolean;
};

export function EmptyState({
  title = "Henüz bir kayıt yok",
  description,
  className,
  children,
  novaAccent = false,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-14 text-center",
        className
      )}
    >
      <div className="relative flex size-[4.5rem] items-center justify-center">
        {novaAccent ? (
          <>
            <Sparkles
              className="pointer-events-none absolute -left-3 top-0 size-[1.1rem] text-[#b8860b]/85 dark:text-amber-400/90"
              aria-hidden
            />
            <Sparkles
              className="pointer-events-none absolute -right-2 -top-2 size-4 rotate-[18deg] text-[#1a1a1a]/35 dark:text-white/25"
              aria-hidden
            />
            <Sparkles
              className="pointer-events-none absolute -bottom-1 -left-2 size-3 rotate-[-12deg] text-primary/50"
              aria-hidden
            />
            <Sparkles
              className="pointer-events-none absolute -bottom-1 -right-2 size-[0.65rem] text-[#1a1a1a]/30 dark:text-white/20"
              aria-hidden
            />
          </>
        ) : null}
        <span
          className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-gradient-to-br from-primary/15 via-transparent to-primary/5 blur-sm ring-1 ring-primary/15"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -inset-3 rounded-full opacity-[0.35] blur-xl"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgb(245 241 233 / 90%), transparent 65%)",
          }}
          aria-hidden
        />
        <span className="relative flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-white/80 shadow-inner ring-1 ring-black/[0.06] backdrop-blur-md dark:bg-zinc-950/70 dark:ring-white/[0.08]">
          <Image
            src="/logo-mark.svg"
            alt=""
            width={40}
            height={40}
            className="size-10 object-contain"
          />
        </span>
      </div>
      <div className="max-w-sm space-y-2">
        <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
          {title}
        </p>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
