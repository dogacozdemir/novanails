"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { addMoney } from "@/lib/money";
import {
  summarizeByPaymentMethod,
  type PaymentMethodSlice,
} from "@/lib/payment-method-summary";
import { LIMITS, sanitizePlainText } from "@/lib/sanitize";
import {
  isValidMonthISO,
  staffPeriodDateRange,
  type StaffPeriod,
} from "@/lib/staff-period";
import { createClient } from "@/lib/supabase/server";
import { isPgrstRelationNotFound } from "@/lib/supabase/postgrest-errors";
import { istanbulDateISO } from "@/lib/time";
import type {
  AppointmentStatus,
  PaymentMethod,
  StaffTimeOffType,
} from "@/types/database";

export type StaffRow = {
  id: string;
  name: string;
  color_code: string;
};

/** Yaklaşan (yapılacak) randevu durumları */
const UPCOMING_STATUSES: AppointmentStatus[] = [
  "waiting",
  "message_sent",
  "confirmed",
];

const PAGE_SIZE = 1000;
const UPCOMING_LIMIT = 100;

/** PostgREST satır sınırına (1000) takılmadan tüm sayfaları okur. */
async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

function assertValidPeriod(period: StaffPeriod) {
  if (period.kind === "month" && !isValidMonthISO(period.monthISO)) {
    throw new Error("Geçersiz dönem.");
  }
}

/** revenue_entries gömülü seçimi — birebir ilişkide nesne, eski sürümlerde dizi gelebilir. */
function embeddedRevenue(
  raw: unknown
): { amount: number; payment_method: PaymentMethod | null } | null {
  const rec = Array.isArray(raw) ? raw[0] : raw;
  if (!rec || typeof rec !== "object") return null;
  const r = rec as { amount?: unknown; payment_method?: unknown };
  if (r.amount == null) return null;
  return {
    amount: Number(r.amount),
    payment_method: (r.payment_method as PaymentMethod | null) ?? null,
  };
}

function embeddedName(raw: unknown): string | null {
  const rec = Array.isArray(raw) ? raw[0] : raw;
  if (!rec || typeof rec !== "object") return null;
  const name = (rec as { name?: unknown }).name;
  return typeof name === "string" ? name : null;
}

export type StaffOverviewRow = StaffRow & {
  completedCount: number;
  revenue: number;
  upcomingCount: number;
};

/** Yönetici: tüm uzmanlar için seçili dönemde tamamlanan iş, tahsilat ve yaklaşan randevu sayısı. */
export async function getStaffOverview(
  period: StaffPeriod
): Promise<StaffOverviewRow[]> {
  await requireAdmin();
  assertValidPeriod(period);
  const supabase = await createClient();
  const range = staffPeriodDateRange(period);
  const todayIso = istanbulDateISO();

  const [staffRes, completed, upcoming] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, color_code")
      .order("created_at", { ascending: true }),
    fetchAllPages<Record<string, unknown>>((from, to) => {
      let q = supabase
        .from("appointments")
        .select("id, staff_id, revenue_entries ( amount )")
        .eq("status", "completed");
      if (range) {
        q = q
          .gte("appointment_date", range.start)
          .lte("appointment_date", range.end);
      }
      return q.order("id").range(from, to);
    }),
    fetchAllPages<Record<string, unknown>>((from, to) =>
      supabase
        .from("appointments")
        .select("id, staff_id")
        .gte("appointment_date", todayIso)
        .in("status", UPCOMING_STATUSES)
        .order("id")
        .range(from, to)
    ),
  ]);

  if (staffRes.error) throw staffRes.error;

  const completedCount = new Map<string, number>();
  const revenue = new Map<string, number>();
  for (const row of completed) {
    const sid = row.staff_id as string;
    completedCount.set(sid, (completedCount.get(sid) ?? 0) + 1);
    const rev = embeddedRevenue(row.revenue_entries);
    if (rev) revenue.set(sid, addMoney(revenue.get(sid) ?? 0, rev.amount));
  }
  const upcomingCount = new Map<string, number>();
  for (const row of upcoming) {
    const sid = row.staff_id as string;
    upcomingCount.set(sid, (upcomingCount.get(sid) ?? 0) + 1);
  }

  return (staffRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    color_code: s.color_code,
    completedCount: completedCount.get(s.id) ?? 0,
    revenue: revenue.get(s.id) ?? 0,
    upcomingCount: upcomingCount.get(s.id) ?? 0,
  }));
}

export type StaffServiceStat = {
  serviceId: string;
  name: string;
  count: number;
  revenue: number;
};

export type StaffUpcomingAppointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  planned_duration: number;
  customerName: string;
  serviceName: string;
};

export type StaffUpcomingTimeOff = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  type: StaffTimeOffType;
  reason: string | null;
};

export type StaffPerformance = {
  staff: StaffRow;
  completedCount: number;
  revenueTotal: number;
  services: StaffServiceStat[];
  paymentMethods: PaymentMethodSlice[];
  paymentMethodsTotal: number;
  statusCounts: Record<AppointmentStatus, number>;
  upcoming: StaffUpcomingAppointment[];
  upcomingTruncated: boolean;
  upcomingTimeOff: StaffUpcomingTimeOff[];
};

/**
 * Yönetici: tek uzmanın seçili dönemdeki (randevu tarihine göre) işleri —
 * hizmet bazında adet/tahsilat, ödeme yöntemleri, durum sayıları;
 * ayrıca bugünden itibaren yaklaşan randevular ve izin/tatil kayıtları.
 */
export async function getStaffPerformance(
  staffId: string,
  period: StaffPeriod
): Promise<StaffPerformance | null> {
  await requireAdmin();
  assertValidPeriod(period);
  const supabase = await createClient();
  const range = staffPeriodDateRange(period);
  const todayIso = istanbulDateISO();

  const { data: staffRow, error: staffErr } = await supabase
    .from("staff")
    .select("id, name, color_code")
    .eq("id", staffId)
    .maybeSingle();
  if (staffErr) throw staffErr;
  if (!staffRow) return null;

  const [periodRows, servicesRes, upcomingRes, offRes] = await Promise.all([
    fetchAllPages<Record<string, unknown>>((from, to) => {
      let q = supabase
        .from("appointments")
        .select(
          "id, status, service_id, revenue_entries ( amount, payment_method )"
        )
        .eq("staff_id", staffId);
      if (range) {
        q = q
          .gte("appointment_date", range.start)
          .lte("appointment_date", range.end);
      }
      return q.order("id").range(from, to);
    }),
    supabase.from("services").select("id, name"),
    supabase
      .from("appointments")
      .select(
        "id, appointment_date, appointment_time, status, planned_duration, customers ( name, surname ), services ( name )"
      )
      .eq("staff_id", staffId)
      .gte("appointment_date", todayIso)
      .in("status", UPCOMING_STATUSES)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })
      .limit(UPCOMING_LIMIT + 1),
    supabase
      .from("staff_time_off")
      .select("id, date, start_time, end_time, type, reason")
      .eq("staff_id", staffId)
      .gte("date", todayIso)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true }),
  ]);

  if (servicesRes.error) throw servicesRes.error;
  if (upcomingRes.error) throw upcomingRes.error;
  if (
    offRes.error &&
    !isPgrstRelationNotFound(offRes.error, "staff_time_off")
  ) {
    throw offRes.error;
  }

  const serviceNames = new Map(
    (servicesRes.data ?? []).map((s) => [s.id, s.name] as const)
  );

  const statusCounts: Record<AppointmentStatus, number> = {
    waiting: 0,
    message_sent: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  };
  const byService = new Map<string, StaffServiceStat>();
  const revenueRows: { amount: number; payment_method: string | null }[] = [];
  let completedCount = 0;
  let revenueTotal = 0;

  for (const row of periodRows) {
    const status = row.status as AppointmentStatus;
    if (status in statusCounts) statusCounts[status] += 1;
    if (status !== "completed") continue;

    completedCount += 1;
    const serviceId = row.service_id as string;
    const stat = byService.get(serviceId) ?? {
      serviceId,
      name: serviceNames.get(serviceId)?.trim() || "—",
      count: 0,
      revenue: 0,
    };
    stat.count += 1;
    const rev = embeddedRevenue(row.revenue_entries);
    if (rev) {
      stat.revenue = addMoney(stat.revenue, rev.amount);
      revenueTotal = addMoney(revenueTotal, rev.amount);
      revenueRows.push(rev);
    }
    byService.set(serviceId, stat);
  }

  const methods = summarizeByPaymentMethod(revenueRows);

  const upcomingAll = (upcomingRes.data ?? []) as Record<string, unknown>[];
  const upcoming: StaffUpcomingAppointment[] = upcomingAll
    .slice(0, UPCOMING_LIMIT)
    .map((r) => {
      const custRaw = Array.isArray(r.customers) ? r.customers[0] : r.customers;
      const cust =
        custRaw && typeof custRaw === "object"
          ? (custRaw as { name?: string; surname?: string })
          : null;
      return {
        id: r.id as string,
        appointment_date: r.appointment_date as string,
        appointment_time: r.appointment_time as string,
        status: r.status as AppointmentStatus,
        planned_duration: Number(r.planned_duration ?? 120),
        customerName: cust
          ? `${cust.name ?? ""} ${cust.surname ?? ""}`.trim() || "—"
          : "—",
        serviceName: embeddedName(r.services)?.trim() || "—",
      };
    });

  const upcomingTimeOff: StaffUpcomingTimeOff[] = (
    offRes.error ? [] : (offRes.data ?? [])
  ).map((r) => ({
    id: r.id as string,
    date: r.date as string,
    start_time: String(r.start_time),
    end_time: String(r.end_time),
    type: r.type as StaffTimeOffType,
    reason: (r.reason as string | null) ?? null,
  }));

  return {
    staff: {
      id: staffRow.id,
      name: staffRow.name,
      color_code: staffRow.color_code,
    },
    completedCount,
    revenueTotal,
    services: Array.from(byService.values()).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr")
    ),
    paymentMethods: methods.slices,
    paymentMethodsTotal: methods.total,
    statusCounts,
    upcoming,
    upcomingTruncated: upcomingAll.length > UPCOMING_LIMIT,
    upcomingTimeOff,
  };
}

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
