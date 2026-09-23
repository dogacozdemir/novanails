"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { isPgrstRelationNotFound } from "@/lib/supabase/postgrest-errors";
import { roundMoney } from "@/lib/money";
import type { StaffTimeOffType } from "@/types/database";

export type SeedSnapshot = {
  staffCount: number;
  servicesCount: number;
  missingDefaultStaff: boolean;
  missingDefaultServices: boolean;
};

export type SeedResult = {
  staffInserted: number;
  servicesInserted: number;
};

export type StaffTimeOffRow = {
  id: string;
  staff_id: string;
  date: string;
  start_time: string;
  end_time: string;
  type: StaffTimeOffType;
  reason: string | null;
};

export type StaffDirectoryEntry = {
  id: string;
  name: string;
  color_code: string;
  time_off: StaffTimeOffRow[];
};

function formatPgTimeLabel(raw: unknown): string {
  const s = String(raw ?? "");
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return s.slice(0, 8);
}

/** Yönetici: uzman listesi ve tüm izin/tatil kayıtları (tarih sıralı). */
export async function getStaffDirectoryWithTimeOff(): Promise<{
  staff: StaffDirectoryEntry[];
  error?: string;
}> {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: staffRows, error: staffErr }, { data: offRows, error: offErr }] =
    await Promise.all([
      supabase
        .from("staff")
        .select("id, name, color_code")
        .order("created_at", { ascending: true }),
      supabase
        .from("staff_time_off")
        .select("id, staff_id, date, start_time, end_time, type, reason")
        .order("date", { ascending: true })
        .order("start_time", { ascending: true }),
    ]);

  if (staffErr) {
    return { staff: [], error: staffErr.message };
  }
  if (offErr && !isPgrstRelationNotFound(offErr, "staff_time_off")) {
    return { staff: [], error: offErr.message };
  }

  const offRowsSafe = offErr ? [] : (offRows ?? []);

  const byStaff = new Map<string, StaffTimeOffRow[]>();
  for (const s of staffRows ?? []) {
    byStaff.set(s.id as string, []);
  }
  for (const r of offRowsSafe) {
    const sid = r.staff_id as string;
    const row: StaffTimeOffRow = {
      id: r.id as string,
      staff_id: sid,
      date: r.date as string,
      start_time: formatPgTimeLabel(r.start_time),
      end_time: formatPgTimeLabel(r.end_time),
      type: r.type as StaffTimeOffType,
      reason: (r.reason as string | null) ?? null,
    };
    const list = byStaff.get(sid) ?? [];
    list.push(row);
    byStaff.set(sid, list);
  }

  return {
    staff: (staffRows ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      color_code: s.color_code as string,
      time_off: byStaff.get(s.id as string) ?? [],
    })),
  };
}

const DEFAULT_STAFF: { name: string; color_code: string }[] = [
  { name: "Nova Uzman I", color_code: "#F5F1E9" },
  { name: "Nova Uzman II", color_code: "#1A1A1A" },
];

/** TRY — süre dakika; fiyatlar örnek liste fiyatı */
const DEFAULT_SERVICES: { name: string; duration: number; price: number }[] = [
  { name: "Jel Tırnak", duration: 90, price: 1299 },
  { name: "Kalıcı Oje", duration: 75, price: 899 },
  { name: "Manikür", duration: 45, price: 549 },
  { name: "Pedikür", duration: 60, price: 749 },
];

export async function getSeedSnapshot(): Promise<SeedSnapshot> {
  const supabase = await createClient();

  const [
    { count: staffCountRaw },
    { count: servicesCountRaw },
    { data: staffNameRows },
    { data: svcRows },
  ] = await Promise.all([
    supabase.from("staff").select("id", { count: "exact", head: true }),
    supabase.from("services").select("id", { count: "exact", head: true }),
    supabase.from("staff").select("name"),
    supabase.from("services").select("name"),
  ]);

  const staffCount = staffCountRaw ?? 0;
  const servicesCount = servicesCountRaw ?? 0;

  const names = new Set(
    (staffNameRows ?? []).map((r) => String(r.name).trim())
  );
  const missingDefaultStaff = DEFAULT_STAFF.some((s) => !names.has(s.name));

  const svcNames = new Set((svcRows ?? []).map((r) => String(r.name).trim()));
  const missingDefaultServices = DEFAULT_SERVICES.some(
    (s) => !svcNames.has(s.name)
  );

  return {
    staffCount,
    servicesCount,
    missingDefaultStaff,
    missingDefaultServices,
  };
}

/** Eksik varsayılan uzman ve hizmetleri idempotent ekler (isim eşleşmesine göre). */
export async function seedStudioDefaults(): Promise<SeedResult> {
  await requireAdmin();
  const supabase = await createClient();
  let staffInserted = 0;
  let servicesInserted = 0;

  const { data: existingStaff } = await supabase.from("staff").select("name");
  const staffNames = new Set(
    (existingStaff ?? []).map((r) => String(r.name).trim())
  );

  for (const row of DEFAULT_STAFF) {
    if (staffNames.has(row.name)) continue;
    const { error } = await supabase.from("staff").insert({
      name: row.name,
      color_code: row.color_code,
    });
    if (error) throw error;
    staffInserted += 1;
    staffNames.add(row.name);
  }

  const { data: existingSvcs } = await supabase.from("services").select("name");
  const svcNames = new Set(
    (existingSvcs ?? []).map((r) => String(r.name).trim())
  );

  for (const row of DEFAULT_SERVICES) {
    if (svcNames.has(row.name)) continue;
    const { error } = await supabase.from("services").insert({
      name: row.name,
      duration: row.duration,
      price: roundMoney(row.price),
    });
    if (error) throw error;
    servicesInserted += 1;
    svcNames.add(row.name);
  }

  revalidatePath("/settings");
  revalidatePath("/services");
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  revalidatePath("/finance");

  return { staffInserted, servicesInserted };
}
