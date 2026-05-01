"use client";

import dynamic from "next/dynamic";

import { GlassSkeleton } from "@/components/ui/glass-skeleton";

const FinanceBoard = dynamic(
  () =>
    import("@/components/finance/finance-board").then((m) => m.FinanceBoard),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto flex min-h-[40vh] max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <GlassSkeleton className="h-10 w-48 rounded-xl" />
        <GlassSkeleton className="h-[min(50vh,28rem)] w-full rounded-3xl" />
      </div>
    ),
  }
);

export function FinanceBoardEntry() {
  return <FinanceBoard />;
}
