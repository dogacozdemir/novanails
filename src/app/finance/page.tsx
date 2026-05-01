import type { Metadata } from "next";

import { FinanceBoardEntry } from "@/components/finance/finance-board-entry";

export const metadata: Metadata = {
  title: "Finans",
};

export default function FinancePage() {
  return <FinanceBoardEntry />;
}
