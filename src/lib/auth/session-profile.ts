import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type SessionProfile = {
  userId: string;
  email: string | undefined;
  role: UserRole;
  staffId: string | null;
};

/**
 * Sunucu bileşeni / server action için oturum + profiles satırı.
 * Oturum yoksa null.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row, error } = await supabase
    .from("profiles")
    .select("role, staff_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("profiles fetch", error);
  }

  const role = (row?.role as UserRole | undefined) ?? "staff";
  const staffId = (row?.staff_id as string | null | undefined) ?? null;

  return {
    userId: user.id,
    email: user.email ?? undefined,
    role,
    staffId,
  };
}

export async function requireSession(): Promise<SessionProfile> {
  const p = await getSessionProfile();
  if (!p) throw new Error("Oturum gerekli.");
  return p;
}
