import "server-only";

import { requireSession } from "@/lib/auth/session-profile";

/** Finans, salon ayarları, yönetici aksiyonları */
export async function requireAdmin(): Promise<void> {
  const p = await requireSession();
  if (p.role !== "admin") {
    throw new Error("Bu işlem yalnızca yöneticiler içindir.");
  }
}
