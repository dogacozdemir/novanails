"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { LIMITS, sanitizePlainText } from "@/lib/sanitize";

export type StaffRow = {
  id: string;
  name: string;
  color_code: string;
};

function normalizeHexColor(input: string): string {
  let s = sanitizePlainText(input, LIMITS.staffColorCode).trim();
  if (!s.startsWith("#")) s = `#${s}`;
  if (
    !/^#[0-9A-Fa-f]{6}$/.test(s) &&
    !/^#[0-9A-Fa-f]{3}$/.test(s)
  ) {
    throw new Error("Renk için geçerli bir hex kodu girin (örn. #F5F1E9).");
  }
  return s.length === 4
    ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
    : s;
}

export async function listStaff(): Promise<StaffRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, color_code")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    color_code: r.color_code,
  }));
}

export async function createStaff(input: { name: string; color_code: string }) {
  await requireAdmin();
  const supabase = await createClient();
  const name = sanitizePlainText(input.name, LIMITS.staffName);
  if (!name.length) throw new Error("Geçerli uzman adı girin.");
  const color_code = normalizeHexColor(input.color_code);

  const { error } = await supabase.from("staff").insert({
    name,
    color_code,
  });
  if (error) throw error;
  revalidatePath("/services");
  revalidatePath("/appointments");
}

export async function updateStaff(
  id: string,
  input: { name: string; color_code: string }
) {
  await requireAdmin();
  const supabase = await createClient();
  const name = sanitizePlainText(input.name, LIMITS.staffName);
  if (!name.length) throw new Error("Geçerli uzman adı girin.");
  const color_code = normalizeHexColor(input.color_code);

  const { error } = await supabase
    .from("staff")
    .update({ name, color_code })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/services");
  revalidatePath("/appointments");
}

export async function deleteStaff(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) {
    if (
      error.code === "23503" ||
      error.message.toLowerCase().includes("foreign")
    ) {
      throw new Error(
        "Bu uzmana bağlı randevular olduğu için silinemez; önce randevuları iptal edin veya başka uzmana taşıyın."
      );
    }
    throw error;
  }
  revalidatePath("/services");
  revalidatePath("/appointments");
}
