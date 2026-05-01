"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="relative flex size-[4.5rem] items-center justify-center">
        <span
          className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-gradient-to-br from-primary/20 via-transparent to-primary/5 blur-md ring-1 ring-primary/15"
          aria-hidden
        />
        <span className="relative flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-white/85 shadow-inner ring-1 ring-black/[0.06] backdrop-blur-md dark:bg-zinc-950/75 dark:ring-white/[0.08]">
          <Image
            src="/logo-mark.svg"
            alt=""
            width={40}
            height={40}
            className="size-10 object-contain"
          />
        </span>
      </div>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Bir şeyler ters gitti
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Beklenmeyen bir hata oluştu. Sayfayı yenileyebilir veya panele
          dönebilirsiniz.
        </p>
        {process.env.NODE_ENV === "development" ? (
          <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-muted/50 p-3 text-left text-xs text-destructive">
            {error.message}
          </pre>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" className="rounded-xl shadow-glass-inner" onClick={() => reset()}>
          Tekrar dene
        </Button>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
