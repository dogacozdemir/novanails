"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/money";
import { LIMITS, sanitizePlainText } from "@/lib/sanitize";

export async function listServices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

function parseOptionalMoney(raw: number | null | undefined): number | null {
  if (raw == null || Number.isNaN(Number(raw))) return null;
  return roundMoney(Number(raw));
}

function parseOptionalDuration(raw: number | null | undefined): number | null {
  if (raw == null || Number.isNaN(Number(raw))) return null;
  const d = Math.round(Number(raw));
  return d > 0 ? d : null;
}

export async function createService(input: {
  name: string;
  price: number | null;
  duration: number | null;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const name = sanitizePlainText(input.name, LIMITS.serviceName);
  if (!name.length) throw new Error("Geçerli hizmet adı girin.");

  const price = parseOptionalMoney(input.price);
  const duration = parseOptionalDuration(input.duration);

  const { error } = await supabase.from("services").insert({
    name,
    price,
    duration,
  });
  if (error) throw error;
  revalidatePath("/services");
  revalidatePath("/settings");
  revalidatePath("/appointments");
}

export async function updateService(
  id: string,
  input: { name: string; price: number | null; duration: number | null }
) {
  await requireAdmin();
  const supabase = await createClient();
  const name = sanitizePlainText(input.name, LIMITS.serviceName);
  if (!name.length) throw new Error("Geçerli hizmet adı girin.");

  const price = parseOptionalMoney(input.price);
  const duration = parseOptionalDuration(input.duration);

  const { error } = await supabase
    .from("services")
    .update({
      name,
      price,
      duration,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/services");
  revalidatePath("/settings");
  revalidatePath("/appointments");
}

export async function deleteService(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "Bu hizmete bağlı randevular var; önce randevuları kaldırın veya silinemez kayıtları güncelleyin."
      );
    }
    throw error;
  }
  revalidatePath("/services");
  revalidatePath("/settings");
  revalidatePath("/appointments");
}
