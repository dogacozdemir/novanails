"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/money";
import {
  LIMITS,
  sanitizeOptionalNotes,
} from "@/lib/sanitize";
import {
  effectivePlannedDurationMinutes,
  findStaffOverlapMinutes,
} from "@/lib/appointment-overlap";
import {
  APPOINTMENT_ACTIVE_SLOT_UNIQUE_ERROR,
  APPOINTMENT_OVERLAP_ERROR,
} from "@/lib/appointment-errors";
import type { BusyIntervalMinutes } from "@/lib/compute-available-slots";
import { computeAvailableSlotStarts } from "@/lib/compute-available-slots";
import {
  CALENDAR_DAY_END_HOUR,
  CALENDAR_DAY_START_HOUR,
  istanbulDateISO,
  iterateDateRangeInclusive,
  parseTimeToMinutesFromMidnight,
} from "@/lib/time";
import { getSessionProfile, requireSession } from "@/lib/auth/session-profile";
import { isPgrstRelationNotFound } from "@/lib/supabase/postgrest-errors";
import type {
  AppointmentStatus,
  Database,
  PaymentMethod,
  StaffTimeOffType,
} from "@/types/database";

export type UpdateAppointmentFullInput = Partial<{
  staff_id: string;
  service_id: string;
  customer_id: string;
  appointment_date: string;
  appointment_time: string;
  planned_duration: number;
  status: AppointmentStatus;
  notes: string | null;
}>;

export type RecordPaymentPayload = {
  final_price: number;
  payment_method: PaymentMethod;
  actual_duration?: number | null;
};

export type CustomerBrief = {
  id: string;
  name: string;
  surname: string;
  phone: string | null;
  /** Müşteriye özel kalıcı not (alerji, tercih vb.) — customers.notes */
  notes: string | null;
};

export type ServiceBrief = {
  id: string;
  name: string;
  /** Opsiyonel katalog değerleri */
  price: number | null;
  duration: number | null;
};

export type StaffBrief = {
  id: string;
  name: string;
  color_code: string;
};

export type EnrichedAppointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  customer_id: string;
  service_id: string;
  staff_id: string;
  status: AppointmentStatus;
  /** Müşteri/randevu oluşturma sırası not — appointments.notes */
  notes: string | null;
  planned_duration: number;
  actual_duration: number | null;
  final_price: number | null;
  payment_method: PaymentMethod | null;
  /** Personel notu — appointments.staff_notes */
  staff_notes: string | null;
  customer: CustomerBrief | null;
  service: ServiceBrief | null;
};

const EMPTY_SLOT_BLOCK_MIN = 120;
const MAX_TIMELINE_EMPTY_EVENTS = 500;

export type TimelineFilterStatus =
  | AppointmentStatus
  | "empty"
  | "holiday"
  | "leave";

export type SearchFilters = {
  dateRange: { start: string; end: string };
  staffIds: string[];
  statuses: TimelineFilterStatus[];
  query: string;
  /**
   * Tahta görünümü: gerçek durum filtresi sonuç vermese bile müsait blokları üret
   * (tahta kolonları boş kalmaz; liste bu bayrağı göndermez).
   */
  implicitEmptySlots?: boolean;
  /**
   * Tahta/liste: durum filtresi boşken iptalleri göster.
   * false olduğunda ve özel durum seçimi yokken SQL sorgusu cancelled dışlar.
   */
  showCancelled?: boolean;
};

export type TimelineEvent =
  | ({ kind: "appointment" } & EnrichedAppointment)
  | {
      kind: "available_slot";
      id: string;
      appointment_date: string;
      appointment_time: string;
      staff_id: string;
      staff_name: string;
      staff_color: string;
      block_minutes: number;
    }
  | {
      kind: "time_off";
      id: string;
      date: string;
      start_time: string;
      end_time: string;
      staff_id: string;
      staff_name: string;
      staff_color: string;
      time_off_type: StaffTimeOffType;
      reason: string | null;
    };

export type ManageStaffTimeOffInput =
  | {
      action: "create";
      staff_id: string;
      date: string;
      start_time: string;
      end_time: string;
      type: StaffTimeOffType;
      reason?: string | null;
    }
  | { action: "delete"; id: string };

function toPgTime(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.trim().split(":");
  const h = (hRaw ?? "00").padStart(2, "0");
  const m = (mRaw ?? "00").padStart(2, "0");
  return `${h}:${m}:00`;
}

async function ensureRevenueEntryForAppointment(
  appointmentId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data: row, error } = await supabase
    .from("appointments")
    .select(
      `
      service_id,
      final_price,
      payment_method,
      services ( price )
    `
    )
    .eq("id", appointmentId)
    .single();

  if (error || !row) throw error ?? new Error("Randevu bulunamadı");

  const svcPrice =
    row.services &&
    typeof row.services === "object" &&
    "price" in row.services
      ? Number((row.services as { price: number | null }).price)
      : null;

  let amount: number;
  if (row.final_price != null) {
    amount = roundMoney(Number(row.final_price));
  } else if (svcPrice != null && !Number.isNaN(svcPrice)) {
    amount = roundMoney(svcPrice);
  } else {
    throw new Error(
      "Gelir kaydı için randevuda final_price veya hizmet katalog fiyatı tanımlı olmalı."
    );
  }

  const pm = row.payment_method ?? null;

  const { error: upErr } = await supabase.from("revenue_entries").upsert(
    {
      appointment_id: appointmentId,
      amount,
      currency: "TRY",
      payment_method: pm,
    },
    { onConflict: "appointment_id" }
  );

  if (upErr) {
    const dup =
      upErr.code === "23505" ||
      upErr.message?.toLowerCase().includes("unique");
    if (!dup) throw upErr;
  }
}

export async function getBoardData(dateISO: string): Promise<{
  staff: StaffBrief[];
  appointments: EnrichedAppointment[];
  customers: CustomerBrief[];
  services: ServiceBrief[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const session = await getSessionProfile();
    const staffScope =
      session?.role === "staff" ? session.staffId ?? null : null;

    if (session?.role === "staff" && !staffScope) {
      return {
        staff: [],
        appointments: [],
        customers: [],
        services: [],
        error:
          "Hesabınız henüz bir uzman ile eşleştirilmedi. Yöneticiye başvurun.",
      };
    }

    let customerIdsFilter: string[] | null = null;
    if (staffScope) {
      const { data: linkRows, error: linkErr } = await supabase
        .from("appointments")
        .select("customer_id")
        .eq("staff_id", staffScope);
      if (linkErr) throw linkErr;
      customerIdsFilter = [
        ...new Set((linkRows ?? []).map((r) => r.customer_id as string)),
      ];
    }

    const customersFetch = () => {
      if (staffScope) {
        if (!customerIdsFilter?.length) {
          return Promise.resolve({
            data: [] as { id: string; name: string; surname: string; phone: string | null; notes: string | null }[],
            error: null,
          });
        }
        return supabase
          .from("customers")
          .select("id, name, surname, phone, notes")
          .in("id", customerIdsFilter!)
          .order("surname");
      }
      return supabase
        .from("customers")
        .select("id, name, surname, phone, notes")
        .order("surname");
    };

    const [
      { data: staff, error: staffErr },
      { data: customers, error: custErr },
      { data: services, error: svcErr },
      { data: rawAppointments, error: apptErr },
    ] = await Promise.all([
      staffScope
        ? supabase.from("staff").select("id, name, color_code").eq("id", staffScope)
        : supabase.from("staff").select("id, name, color_code").order("created_at", {
            ascending: true,
          }),
      customersFetch(),
      supabase.from("services").select("id, name, price, duration").order("name"),
      staffScope
        ? supabase
            .from("appointments")
            .select("*")
            .eq("appointment_date", dateISO)
            .eq("staff_id", staffScope)
        : supabase.from("appointments").select("*").eq("appointment_date", dateISO),
    ]);

    if (staffErr) throw staffErr;
    if (custErr) throw custErr;
    if (svcErr) throw svcErr;
    if (apptErr) throw apptErr;

    const custMap = Object.fromEntries(
      (customers ?? []).map((c) => [
        c.id,
        {
          id: c.id,
          name: c.name,
          surname: c.surname,
          phone: c.phone,
          notes: c.notes ?? null,
        } satisfies CustomerBrief,
      ])
    );
    const svcMap = Object.fromEntries(
      (services ?? []).map((s) => [
        s.id,
        {
          id: s.id,
          name: s.name,
          price: s.price != null ? Number(s.price) : null,
          duration: s.duration != null ? Number(s.duration) : null,
        } satisfies ServiceBrief,
      ])
    );

    const appointments: EnrichedAppointment[] = (rawAppointments ?? []).map(
      (row: Record<string, unknown>) => ({
        id: row.id as string,
        appointment_date: row.appointment_date as string,
        appointment_time: row.appointment_time as string,
        customer_id: row.customer_id as string,
        service_id: row.service_id as string,
        staff_id: row.staff_id as string,
        status: row.status as AppointmentStatus,
        notes: (row.notes as string | null) ?? null,
        planned_duration: Number(row.planned_duration ?? 120),
        actual_duration:
          row.actual_duration != null ? Number(row.actual_duration) : null,
        final_price:
          row.final_price != null ? Number(row.final_price) : null,
        payment_method: (row.payment_method as PaymentMethod | null) ?? null,
        staff_notes: (row.staff_notes as string | null) ?? null,
        customer: custMap[row.customer_id as string] ?? null,
        service: svcMap[row.service_id as string] ?? null,
      })
    );

    return {
      staff: (staff ?? []) as StaffBrief[],
      appointments,
      customers: (customers ?? []) as CustomerBrief[],
      services: (services ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price != null ? Number(s.price) : null,
        duration: s.duration != null ? Number(s.duration) : null,
      })),
    };
  } catch (e) {
    console.error(e);
    return {
      staff: [],
      appointments: [],
      customers: [],
      services: [],
      error: e instanceof Error ? e.message : "Veri yüklenemedi",
    };
  }
}

/** Tek randevuyu müşteri, hizmet ve uzman meta verisiyle döndürür (CRM / detay sayfası). */
export async function getEnrichedAppointmentById(
  appointmentId: string
): Promise<{ appointment: EnrichedAppointment | null; error?: string }> {
  try {
    const supabase = await createClient();
    const session = await getSessionProfile();
    const staffScope =
      session?.role === "staff" ? session.staffId ?? null : null;

    if (session?.role === "staff" && !staffScope) {
      return {
        appointment: null,
        error:
          "Hesabınız henüz bir uzman ile eşleştirilmedi. Yöneticiye başvurun.",
      };
    }

    const { data: row, error } = await supabase
      .from("appointments")
      .select(
        `
        *,
        customers ( id, name, surname, phone, notes ),
        services ( id, name, price, duration )
      `
      )
      .eq("id", appointmentId)
      .maybeSingle();

    if (error) throw error;
    if (!row) return { appointment: null };

    const r = row as Record<string, unknown>;
    if (staffScope && (r.staff_id as string) !== staffScope) {
      return { appointment: null, error: "Bu randevuya erişim yetkiniz yok." };
    }

    const custRaw = r.customers;
    const svcRaw = r.services;
    const custRec =
      custRaw && typeof custRaw === "object" && custRaw !== null
        ? (custRaw as Record<string, unknown>)
        : null;
    const cust =
      custRec && custRec.id != null
        ? {
            id: String(custRec.id),
            name: String(custRec.name ?? ""),
            surname: String(custRec.surname ?? ""),
            phone: (custRec.phone as string | null) ?? null,
            notes: (custRec.notes as string | null) ?? null,
          }
        : null;
    const svcRec =
      svcRaw && typeof svcRaw === "object" && svcRaw !== null
        ? (svcRaw as Record<string, unknown>)
        : null;
    const svc =
      svcRec && svcRec.id != null
        ? {
            id: String(svcRec.id),
            name: String(svcRec.name ?? ""),
            price: svcRec.price != null ? Number(svcRec.price) : null,
            duration:
              svcRec.duration != null ? Number(svcRec.duration) : null,
          }
        : null;

    const appointment: EnrichedAppointment = {
      id: r.id as string,
      appointment_date: r.appointment_date as string,
      appointment_time: r.appointment_time as string,
      customer_id: r.customer_id as string,
      service_id: r.service_id as string,
      staff_id: r.staff_id as string,
      status: r.status as AppointmentStatus,
      notes: (r.notes as string | null) ?? null,
      planned_duration: Number(r.planned_duration ?? 120),
      actual_duration:
        r.actual_duration != null ? Number(r.actual_duration) : null,
      final_price: r.final_price != null ? Number(r.final_price) : null,
      payment_method: (r.payment_method as PaymentMethod | null) ?? null,
      staff_notes: (r.staff_notes as string | null) ?? null,
      customer: cust,
      service: svc,
    };

    return { appointment };
  } catch (e) {
    console.error(e);
    return {
      appointment: null,
      error: e instanceof Error ? e.message : "Randevu yüklenemedi",
    };
  }
}

/** Bugünden itibaren teyit bekleyen / mesaj gönderilmiş randevular (liste + teyit sayfası). */
export async function listPendingConfirmations(): Promise<{
  appointments: EnrichedAppointment[];
  staffList: StaffBrief[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const session = await getSessionProfile();
    const staffScope =
      session?.role === "staff" ? session.staffId ?? null : null;

    if (session?.role === "staff" && !staffScope) {
      return {
        appointments: [],
        staffList: [],
        error:
          "Hesabınız henüz bir uzman ile eşleştirilmedi. Yöneticiye başvurun.",
      };
    }

    const todayIso = istanbulDateISO();

    let query = supabase
      .from("appointments")
      .select("*")
      .in("status", ["waiting", "message_sent"])
      .gte("appointment_date", todayIso)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (staffScope) {
      query = query.eq("staff_id", staffScope);
    }

    const { data: rawRows, error: apptErr } = await query;

    if (apptErr) throw apptErr;

    const rawAppointments = rawRows ?? [];
    if (rawAppointments.length === 0) {
      return {
        appointments: [],
        staffList: [],
      };
    }

    const customerIds = [
      ...new Set(rawAppointments.map((r) => r.customer_id as string)),
    ];
    const serviceIds = [
      ...new Set(rawAppointments.map((r) => r.service_id as string)),
    ];
    const staffIds = [
      ...new Set(rawAppointments.map((r) => r.staff_id as string)),
    ];

    const [{ data: custRows }, { data: svcRows }, { data: stfRows }] =
      await Promise.all([
        customerIds.length
          ? supabase
              .from("customers")
              .select("id, name, surname, phone, notes")
              .in("id", customerIds)
          : Promise.resolve({ data: [] }),
        serviceIds.length
          ? supabase
              .from("services")
              .select("id, name, price, duration")
              .in("id", serviceIds)
          : Promise.resolve({ data: [] }),
        staffIds.length
          ? supabase
              .from("staff")
              .select("id, name, color_code")
              .in("id", staffIds)
          : Promise.resolve({ data: [] }),
      ]);

    const custMap = Object.fromEntries(
      (custRows ?? []).map((c) => [
        c.id,
        {
          id: c.id,
          name: c.name,
          surname: c.surname,
          phone: c.phone,
          notes: c.notes ?? null,
        } satisfies CustomerBrief,
      ])
    );
    const svcMap = Object.fromEntries(
      (svcRows ?? []).map((s) => [
        s.id,
        {
          id: s.id,
          name: s.name,
          price: s.price != null ? Number(s.price) : null,
          duration: s.duration != null ? Number(s.duration) : null,
        } satisfies ServiceBrief,
      ])
    );

    const appointments: EnrichedAppointment[] = rawAppointments.map(
      (row: Record<string, unknown>) => ({
        id: row.id as string,
        appointment_date: row.appointment_date as string,
        appointment_time: row.appointment_time as string,
        customer_id: row.customer_id as string,
        service_id: row.service_id as string,
        staff_id: row.staff_id as string,
        status: row.status as AppointmentStatus,
        notes: (row.notes as string | null) ?? null,
        planned_duration: Number(row.planned_duration ?? 120),
        actual_duration:
          row.actual_duration != null ? Number(row.actual_duration) : null,
        final_price:
          row.final_price != null ? Number(row.final_price) : null,
        payment_method: (row.payment_method as PaymentMethod | null) ?? null,
        staff_notes: (row.staff_notes as string | null) ?? null,
        customer: custMap[row.customer_id as string] ?? null,
        service: svcMap[row.service_id as string] ?? null,
      })
    );

    return {
      appointments,
      staffList: (stfRows ?? []) as StaffBrief[],
    };
  } catch (e) {
    console.error(e);
    return {
      appointments: [],
      staffList: [],
      error: e instanceof Error ? e.message : "Veri yüklenemedi",
    };
  }
}

async function fetchBusyIntervalsForStaffDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffId: string,
  dateISO: string
): Promise<BusyIntervalMinutes[]> {
  const { data: apptRows, error: apErr } = await supabase
    .from("appointments")
    .select("appointment_time, planned_duration, status")
    .eq("staff_id", staffId)
    .eq("appointment_date", dateISO)
    .neq("status", "cancelled");

  if (apErr) throw apErr;

  const { data: offRows, error: offErr } = await supabase
    .from("staff_time_off")
    .select("start_time, end_time")
    .eq("staff_id", staffId)
    .eq("date", dateISO);

  if (offErr && !isPgrstRelationNotFound(offErr, "staff_time_off")) {
    throw offErr;
  }

  const busy: BusyIntervalMinutes[] = [];

  for (const r of apptRows ?? []) {
    if ((r.status as string) === "cancelled") continue;
    const start = parseTimeToMinutesFromMidnight(String(r.appointment_time));
    const len = effectivePlannedDurationMinutes(
      r.planned_duration !== null && r.planned_duration !== undefined
        ? Number(r.planned_duration)
        : null,
      120
    );
    busy.push({ start, end: start + len });
  }
  for (const r of offErr ? [] : (offRows ?? [])) {
    const start = parseTimeToMinutesFromMidnight(String(r.start_time));
    const end = parseTimeToMinutesFromMidnight(String(r.end_time));
    if (end > start) busy.push({ start, end });
  }
  return busy;
}

/**
 * İş günü içinde sabit 2 saatlik bloklardan (FIXED_SLOTS) seçilen süre sığan başlangıç saatleri.
 * İptal randevuları ve personel izin/tatil blokları müsaitlikten düşülür.
 */
export async function getAvailableSlots(
  dateISO: string,
  staffId: string,
  durationMinutes: number
): Promise<{ slots: string[] }> {
  const session = await requireSession();

  if (session.role === "staff") {
    if (!session.staffId || session.staffId !== staffId) {
      throw new Error("Bu uzmanın müsait saatlerini görüntüleyemezsiniz.");
    }
  }

  const dur = effectivePlannedDurationMinutes(durationMinutes, 120);
  const workStart = CALENDAR_DAY_START_HOUR * 60;
  const workEnd = CALENDAR_DAY_END_HOUR * 60;

  if (dur > workEnd - workStart) {
    return { slots: [] };
  }

  const supabase = await createClient();
  const busy = await fetchBusyIntervalsForStaffDate(
    supabase,
    staffId,
    dateISO
  );

  return {
    slots: computeAvailableSlotStarts({
      busyIntervals: busy,
      durationMinutes: dur,
    }),
  };
}

export async function createAppointment(input: {
  staff_id: string;
  appointment_date: string;
  appointment_time: string;
  customer_id: string;
  service_id: string;
  /** Müşteri görünür not — appointments.notes */
  appointment_notes?: string | null;
  /** Personel notu — appointments.staff_notes */
  staff_notes?: string | null;
  /** Takvim blok süresi (dk), varsayılan 120 */
  planned_duration?: number;
}) {
  const supabase = await createClient();
  const session = await requireSession();
  let effectiveStaffId = input.staff_id;
  if (session.role === "staff") {
    if (!session.staffId) {
      throw new Error("Hesabınız henüz bir uzman ile eşleştirilmedi.");
    }
    if (input.staff_id !== session.staffId) {
      throw new Error("Sadece kendi adınıza randevu oluşturabilirsiniz.");
    }
    effectiveStaffId = session.staffId;
  }
  const pgTime = toPgTime(input.appointment_time);
  const notes = sanitizeOptionalNotes(
    input.appointment_notes,
    LIMITS.appointmentNotes
  );
  const staffNotes = sanitizeOptionalNotes(
    input.staff_notes,
    LIMITS.staffNotes
  );

  const { data: newSvc, error: nsErr } = await supabase
    .from("services")
    .select("id")
    .eq("id", input.service_id)
    .single();

  if (nsErr || !newSvc) throw nsErr ?? new Error("Hizmet bulunamadı.");

  const newDurationMinutes = effectivePlannedDurationMinutes(
    input.planned_duration,
    120
  );

  const newStartMinutes = parseTimeToMinutesFromMidnight(pgTime);

  const { data: existingRows, error: listErr } = await supabase
    .from("appointments")
    .select("appointment_time, planned_duration, status")
    .eq("staff_id", effectiveStaffId)
    .eq("appointment_date", input.appointment_date)
    .neq("status", "cancelled");

  if (listErr) throw listErr;

  const existing = (existingRows ?? []).map((r) => ({
    appointment_time: String(r.appointment_time),
    durationMinutes: effectivePlannedDurationMinutes(
      r.planned_duration != null ? Number(r.planned_duration) : null,
      120
    ),
    status: r.status as AppointmentStatus,
  }));

  if (
    findStaffOverlapMinutes({
      newStartMinutes,
      newDurationMinutes,
      existing,
    })
  ) {
    throw new Error(APPOINTMENT_OVERLAP_ERROR);
  }

  const { error } = await supabase.from("appointments").insert({
    staff_id: effectiveStaffId,
    appointment_date: input.appointment_date,
    appointment_time: pgTime,
    customer_id: input.customer_id,
    service_id: input.service_id,
    status: "waiting",
    notes,
    staff_notes: staffNotes,
    planned_duration: newDurationMinutes,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("çakışıyor")) {
      throw new Error(APPOINTMENT_OVERLAP_ERROR);
    }
    const dup =
      error.code === "23505" ||
      msg.toLowerCase().includes("unique");
    if (dup) {
      throw new Error(APPOINTMENT_ACTIVE_SLOT_UNIQUE_ERROR);
    }
    throw error;
  }
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
}

/** Yönetici: randevuyu kalıcı siler; revenue_entries appointment_id üzerinden CASCADE silinir. */
export async function deleteAppointment(appointmentId: string) {
  const session = await requireSession();
  if (session.role !== "admin") {
    throw new Error("Bu işlem için yönetici olmalısınız.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointmentId);
  if (error) throw error;
  revalidatePath("/appointments");
  revalidatePath("/appointments/confirm");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
}

/**
 * Randevunun tüm temel alanlarını günceller.
 * Çakışma: yalnızca staff_id, appointment_date, appointment_time veya planned_duration etkileniyorsa kontrol edilir.
 */
export async function updateAppointmentFull(
  appointmentId: string,
  data: UpdateAppointmentFullInput
) {
  const keys = Object.keys(data) as (keyof UpdateAppointmentFullInput)[];
  if (keys.length === 0) return;

  const supabase = await createClient();
  const session = await requireSession();

  const { data: row, error: fetchErr } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (fetchErr || !row) throw fetchErr ?? new Error("Randevu bulunamadı.");

  const rowStatus = row.status as AppointmentStatus;

  if (session.role === "staff") {
    if (!session.staffId || row.staff_id !== session.staffId) {
      throw new Error("Bu randevuyu düzenleyemezsiniz.");
    }
    if (rowStatus === "completed" || rowStatus === "cancelled") {
      throw new Error(
        "Tamamlanan veya iptal edilmiş randevuları düzenleyemezsiniz."
      );
    }
    if (data.status !== undefined) {
      throw new Error("Randevu durumunu değiştirmek için yetkiniz yok.");
    }
  }

  const nextStaffId = (data.staff_id ?? row.staff_id) as string;
  const nextDate = (data.appointment_date ?? row.appointment_date) as string;
  const nextTimePg =
    data.appointment_time !== undefined
      ? toPgTime(data.appointment_time)
      : String(row.appointment_time);
  const nextPlanned = effectivePlannedDurationMinutes(
    data.planned_duration !== undefined
      ? Number(data.planned_duration)
      : row.planned_duration != null
        ? Number(row.planned_duration)
        : null,
    120
  );

  const prevStaffId = row.staff_id as string;
  const prevDate = row.appointment_date as string;
  const prevTimePg = String(row.appointment_time);
  const prevPlanned = effectivePlannedDurationMinutes(
    row.planned_duration != null ? Number(row.planned_duration) : null,
    120
  );

  const overlapRelevantChanged =
    nextStaffId !== prevStaffId ||
    nextDate !== prevDate ||
    parseTimeToMinutesFromMidnight(nextTimePg) !==
      parseTimeToMinutesFromMidnight(prevTimePg) ||
    nextPlanned !== prevPlanned;

  if (overlapRelevantChanged) {
    const newStartMinutes = parseTimeToMinutesFromMidnight(nextTimePg);
    const { data: existingRows, error: listErr } = await supabase
      .from("appointments")
      .select("id, appointment_time, planned_duration, status")
      .eq("staff_id", nextStaffId)
      .eq("appointment_date", nextDate)
      .neq("status", "cancelled")
      .neq("id", appointmentId);

    if (listErr) throw listErr;

    const existing = (existingRows ?? []).map((r) => ({
      appointment_time: String(r.appointment_time),
      durationMinutes: effectivePlannedDurationMinutes(
        r.planned_duration != null ? Number(r.planned_duration) : null,
        120
      ),
      status: r.status as AppointmentStatus,
    }));

    if (
      findStaffOverlapMinutes({
        newStartMinutes,
        newDurationMinutes: nextPlanned,
        existing,
      })
    ) {
      throw new Error(APPOINTMENT_OVERLAP_ERROR);
    }
  }

  const updates: Record<string, unknown> = {};

  if (data.staff_id !== undefined) updates.staff_id = data.staff_id;
  if (data.service_id !== undefined) updates.service_id = data.service_id;
  if (data.customer_id !== undefined) updates.customer_id = data.customer_id;
  if (data.appointment_date !== undefined) {
    updates.appointment_date = data.appointment_date;
  }
  if (data.appointment_time !== undefined) {
    updates.appointment_time = toPgTime(data.appointment_time);
  }
  if (data.planned_duration !== undefined) {
    updates.planned_duration = effectivePlannedDurationMinutes(
      data.planned_duration,
      120
    );
  }
  if (data.status !== undefined) updates.status = data.status;
  if (data.notes !== undefined) {
    updates.notes = sanitizeOptionalNotes(data.notes, LIMITS.appointmentNotes);
  }

  const { error: updErr } = await supabase
    .from("appointments")
    .update(
      updates as Database["public"]["Tables"]["appointments"]["Update"]
    )
    .eq("id", appointmentId);

  if (updErr) {
    const msg = updErr.message ?? "";
    if (msg.includes("çakışıyor")) {
      throw new Error(APPOINTMENT_OVERLAP_ERROR);
    }
    const dup =
      updErr.code === "23505" || msg.toLowerCase().includes("unique");
    if (dup) {
      throw new Error(APPOINTMENT_ACTIVE_SLOT_UNIQUE_ERROR);
    }
    throw updErr;
  }

  const mergedStatus = (
    data.status !== undefined ? data.status : rowStatus
  ) as AppointmentStatus;

  if (mergedStatus === "completed") {
    await ensureRevenueEntryForAppointment(appointmentId, supabase);
  }

  revalidatePath("/appointments");
  revalidatePath("/appointments/confirm");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
) {
  const session = await requireSession();
  if (session.role === "staff") {
    throw new Error("Bu işlem için yetkiniz yok.");
  }
  const supabase = await createClient();
  if (status === "completed") {
    await ensureRevenueEntryForAppointment(id, supabase);
  }
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
}

export async function recordPaymentAndComplete(
  appointmentId: string,
  input: RecordPaymentPayload
) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: ownerRow, error: ownerErr } = await supabase
    .from("appointments")
    .select("staff_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (ownerErr) throw ownerErr;
  if (!ownerRow) throw new Error("Randevu bulunamadı.");

  if (session.role === "staff") {
    if (!session.staffId || ownerRow.staff_id !== session.staffId) {
      throw new Error("Bu randevu için ödeme kaydı yapamazsınız.");
    }
  }

  const amount = roundMoney(input.final_price);
  const actualDur =
    input.actual_duration != null &&
    Number.isFinite(input.actual_duration) &&
    input.actual_duration > 0
      ? Math.round(input.actual_duration)
      : null;

  const { error: updErr } = await supabase
    .from("appointments")
    .update({
      status: "completed",
      final_price: amount,
      payment_method: input.payment_method,
      actual_duration: actualDur,
    })
    .eq("id", appointmentId);

  if (updErr) throw updErr;

  const { error: revErr } = await supabase.from("revenue_entries").upsert(
    {
      appointment_id: appointmentId,
      amount,
      currency: "TRY",
      payment_method: input.payment_method,
    },
    { onConflict: "appointment_id" }
  );

  if (revErr) throw revErr;

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
}

function normalizeSearchDateRange(start: string, end: string): {
  start: string;
  end: string;
} {
  let a = start;
  let b = end;
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }
  return { start: a, end: b };
}

function escapeIlikeToken(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function mergeBusyMap(
  map: Map<string, BusyIntervalMinutes[]>,
  staffId: string,
  dateStr: string,
  interval: BusyIntervalMinutes
) {
  const k = `${staffId}|${dateStr}`;
  const arr = map.get(k) ?? [];
  arr.push(interval);
  map.set(k, arr);
}

function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  const kindRank = (e: TimelineEvent) =>
    e.kind === "appointment" ? 0 : e.kind === "time_off" ? 1 : 2;
  return [...events].sort((a, b) => {
    const dateA = a.kind === "time_off" ? a.date : a.appointment_date;
    const dateB = b.kind === "time_off" ? b.date : b.appointment_date;
    const dc = dateA.localeCompare(dateB);
    if (dc !== 0) return dc;
    const tA =
      a.kind === "time_off"
        ? parseTimeToMinutesFromMidnight(a.start_time)
        : parseTimeToMinutesFromMidnight(a.appointment_time);
    const tB =
      b.kind === "time_off"
        ? parseTimeToMinutesFromMidnight(b.start_time)
        : parseTimeToMinutesFromMidnight(b.appointment_time);
    if (tA !== tB) return tA - tB;
    return kindRank(a) - kindRank(b);
  });
}

/** Gelişmiş liste / zaman çizelgesi: randevular, boş slotlar, izin/tatil. */
export async function searchAppointmentsAdvanced(
  filters: SearchFilters
): Promise<{ events: TimelineEvent[]; error?: string }> {
  try {
    const supabase = await createClient();
    const session = await getSessionProfile();
    if (!session) {
      return { events: [], error: "Oturum gerekli." };
    }

    const staffScope =
      session.role === "staff" ? session.staffId ?? null : null;

    if (session.role === "staff" && !staffScope) {
      return {
        events: [],
        error:
          "Hesabınız henüz bir uzman ile eşleştirilmedi. Yöneticiye başvurun.",
      };
    }

    const { start: rangeStart, end: rangeEnd } = normalizeSearchDateRange(
      filters.dateRange.start,
      filters.dateRange.end
    );

    const noStatusPick = filters.statuses.length === 0;
    const hideCancelledWhenUnfiltered =
      noStatusPick && filters.showCancelled === false;
    const sel = new Set(filters.statuses);
    const includeEmpty = !noStatusPick && sel.has("empty");
    const includeHoliday = !noStatusPick && sel.has("holiday");
    const includeLeave = !noStatusPick && sel.has("leave");
    const apptOnly = filters.statuses.filter(
      (s): s is AppointmentStatus =>
        s !== "empty" && s !== "holiday" && s !== "leave"
    );

    const appointmentStatusFilter: AppointmentStatus[] | null = noStatusPick
      ? null
      : apptOnly.length > 0
        ? apptOnly
        : null;

    let staffQuery = supabase
      .from("staff")
      .select("id, name, color_code")
      .order("created_at", { ascending: true });
    if (staffScope) {
      staffQuery = staffQuery.eq("id", staffScope);
    }
    const { data: staffRows, error: staffErr } = await staffQuery;
    if (staffErr) throw staffErr;

    const staffList = (staffRows ?? []) as StaffBrief[];
    const staffMap = Object.fromEntries(
      staffList.map((s) => [s.id, s] as const)
    );
    const knownStaffIds = new Set(staffList.map((s) => s.id));

    const requestedStaff = filters.staffIds.filter((id) =>
      knownStaffIds.has(id)
    );
    const effectiveStaffIds = staffScope
      ? [staffScope]
      : requestedStaff.length > 0
        ? requestedStaff
        : staffList.map((s) => s.id);

    let customerIdFilter: string[] | null = null;
    const qRaw = filters.query.trim();
    if (qRaw.length > 0) {
      const pat = `%${escapeIlikeToken(qRaw)}%`;
      let custQ = supabase.from("customers").select("id").or(
        `name.ilike.${pat},surname.ilike.${pat},phone.ilike.${pat}`
      );
      if (staffScope) {
        const { data: linkRows, error: linkErr } = await supabase
          .from("appointments")
          .select("customer_id")
          .eq("staff_id", staffScope);
        if (linkErr) throw linkErr;
        const allowed = [
          ...new Set((linkRows ?? []).map((r) => r.customer_id as string)),
        ];
        if (!allowed.length) {
          customerIdFilter = [];
        } else {
          custQ = custQ.in("id", allowed);
        }
      }
      if (customerIdFilter?.length !== 0) {
        const { data: hits, error: cErr } = await custQ;
        if (cErr) throw cErr;
        customerIdFilter = [
          ...new Set((hits ?? []).map((h) => h.id as string)),
        ];
      }
    }

    const events: TimelineEvent[] = [];

    const searchPreventsAppointmentFetch =
      filters.query.trim().length > 0 &&
      Array.isArray(customerIdFilter) &&
      customerIdFilter.length === 0;

    if (searchPreventsAppointmentFetch) {
      /* müşteri araması sonuç vermedi (yalnızca anlamlı metin için) */
    } else {
      let apptQ = supabase
        .from("appointments")
        .select(
          `
          id,
          appointment_date,
          appointment_time,
          customer_id,
          service_id,
          staff_id,
          status,
          notes,
          planned_duration,
          actual_duration,
          final_price,
          payment_method,
          staff_notes,
          customers ( id, name, surname, phone, notes ),
          services ( id, name, price, duration ),
          staff ( id, name, color_code )
        `
        )
        .gte("appointment_date", rangeStart)
        .lte("appointment_date", rangeEnd);

      if (effectiveStaffIds.length) {
        apptQ = apptQ.in("staff_id", effectiveStaffIds);
      }
      if (appointmentStatusFilter?.length) {
        apptQ = apptQ.in("status", appointmentStatusFilter);
      }
      if (hideCancelledWhenUnfiltered) {
        apptQ = apptQ.neq("status", "cancelled");
      }
      if (customerIdFilter?.length) {
        apptQ = apptQ.in("customer_id", customerIdFilter);
      }

      const { data: apptData, error: apErr } = await apptQ;
      if (apErr) throw apErr;

      for (const row of apptData ?? []) {
        const r = row as Record<string, unknown>;
        const custRaw = r.customers;
        const svcRaw = r.services;
        const custRec =
          custRaw && typeof custRaw === "object" && custRaw !== null
            ? (custRaw as unknown as Record<string, unknown>)
            : null;
        const cust =
          custRec && custRec.id != null
            ? {
                id: String(custRec.id),
                name: String(custRec.name ?? ""),
                surname: String(custRec.surname ?? ""),
                phone: (custRec.phone as string | null) ?? null,
                notes: (custRec.notes as string | null) ?? null,
              }
            : null;
        const svcRec =
          svcRaw && typeof svcRaw === "object" && svcRaw !== null
            ? (svcRaw as unknown as Record<string, unknown>)
            : null;
        const svc =
          svcRec && svcRec.id != null
            ? {
                id: String(svcRec.id),
                name: String(svcRec.name ?? ""),
                price:
                  svcRec.price != null ? Number(svcRec.price) : null,
                duration:
                  svcRec.duration != null ? Number(svcRec.duration) : null,
              }
            : null;

        const enriched: EnrichedAppointment = {
          id: r.id as string,
          appointment_date: r.appointment_date as string,
          appointment_time: r.appointment_time as string,
          customer_id: r.customer_id as string,
          service_id: r.service_id as string,
          staff_id: r.staff_id as string,
          status: r.status as AppointmentStatus,
          notes: (r.notes as string | null) ?? null,
          planned_duration: Number(r.planned_duration ?? 120),
          actual_duration:
            r.actual_duration != null ? Number(r.actual_duration) : null,
          final_price:
            r.final_price != null ? Number(r.final_price) : null,
          payment_method: (r.payment_method as PaymentMethod | null) ?? null,
          staff_notes: (r.staff_notes as string | null) ?? null,
          customer: cust,
          service: svc,
        };
        events.push({
          kind: "appointment",
          ...enriched,
        });
      }
    }

    if (!noStatusPick && (includeHoliday || includeLeave)) {
      const types: StaffTimeOffType[] = [];
      if (includeHoliday) types.push("holiday");
      if (includeLeave) types.push("leave");

      let offQ = supabase
        .from("staff_time_off")
        .select(
          "id, staff_id, date, start_time, end_time, type, reason, staff ( id, name, color_code )"
        )
        .gte("date", rangeStart)
        .lte("date", rangeEnd);
      if (effectiveStaffIds.length) {
        offQ = offQ.in("staff_id", effectiveStaffIds);
      }
      if (types.length === 1) {
        offQ = offQ.eq("type", types[0]);
      } else if (types.length === 2) {
        offQ = offQ.in("type", types);
      }

      const { data: offData, error: offErr } = await offQ;
      if (offErr && !isPgrstRelationNotFound(offErr, "staff_time_off")) {
        throw offErr;
      }

      for (const row of offErr ? [] : (offData ?? [])) {
        const r = row as Record<string, unknown>;
        const stfRaw = r.staff;
        const stfRec =
          stfRaw && typeof stfRaw === "object" && stfRaw !== null
            ? (stfRaw as unknown as Record<string, unknown>)
            : null;
        const stf =
          stfRec && stfRec.name != null
            ? {
                name: String(stfRec.name),
                color_code: String(stfRec.color_code ?? "#999"),
              }
            : staffMap[r.staff_id as string] ?? {
                name: "—",
                color_code: "#999",
              };

        events.push({
          kind: "time_off",
          id: r.id as string,
          date: r.date as string,
          start_time: normalizeTimeForEvent(String(r.start_time)),
          end_time: normalizeTimeForEvent(String(r.end_time)),
          staff_id: r.staff_id as string,
          staff_name: stf.name,
          staff_color: stf.color_code,
          time_off_type: r.type as StaffTimeOffType,
          reason: (r.reason as string | null) ?? null,
        });
      }
    }

    const emitAvailableSlots =
      effectiveStaffIds.length > 0 &&
      (includeEmpty || filters.implicitEmptySlots === true);

    if (emitAvailableSlots) {
      const busyMap = new Map<string, BusyIntervalMinutes[]>();

      let apptBusyQ = supabase
        .from("appointments")
        .select(
          "staff_id, appointment_date, appointment_time, planned_duration, status"
        )
        .gte("appointment_date", rangeStart)
        .lte("appointment_date", rangeEnd)
        .neq("status", "cancelled");
      apptBusyQ = apptBusyQ.in("staff_id", effectiveStaffIds);
      const { data: apBusy, error: abErr } = await apptBusyQ;
      if (abErr) throw abErr;
      for (const r of apBusy ?? []) {
        if ((r.status as string) === "cancelled") continue;
        const start = parseTimeToMinutesFromMidnight(
          String(r.appointment_time)
        );
        const len = effectivePlannedDurationMinutes(
          r.planned_duration != null ? Number(r.planned_duration) : null,
          120
        );
        mergeBusyMap(busyMap, r.staff_id as string, r.appointment_date as string, {
          start,
          end: start + len,
        });
      }

      let offBusyQ = supabase
        .from("staff_time_off")
        .select("staff_id, date, start_time, end_time")
        .gte("date", rangeStart)
        .lte("date", rangeEnd);
      offBusyQ = offBusyQ.in("staff_id", effectiveStaffIds);
      const { data: offBusy, error: obErr } = await offBusyQ;
      if (obErr && !isPgrstRelationNotFound(obErr, "staff_time_off")) {
        throw obErr;
      }
      for (const r of obErr ? [] : (offBusy ?? [])) {
        const sm = parseTimeToMinutesFromMidnight(String(r.start_time));
        const em = parseTimeToMinutesFromMidnight(String(r.end_time));
        if (em > sm) {
          mergeBusyMap(busyMap, r.staff_id as string, r.date as string, {
            start: sm,
            end: em,
          });
        }
      }

      const days = iterateDateRangeInclusive(rangeStart, rangeEnd);
      let emptyCount = 0;
      outer: for (const dateISO of days) {
        for (const staffId of effectiveStaffIds) {
          const staffMeta = staffMap[staffId];
          if (!staffMeta) continue;
          const busy = busyMap.get(`${staffId}|${dateISO}`) ?? [];
          const slots = computeAvailableSlotStarts({
            busyIntervals: busy,
            durationMinutes: EMPTY_SLOT_BLOCK_MIN,
          });
          for (const slot of slots) {
            events.push({
              kind: "available_slot",
              id: `empty-${staffId}-${dateISO}-${slot}`,
              appointment_date: dateISO,
              appointment_time: `${slot}:00`,
              staff_id: staffId,
              staff_name: staffMeta.name,
              staff_color: staffMeta.color_code,
              block_minutes: EMPTY_SLOT_BLOCK_MIN,
            });
            emptyCount += 1;
            if (emptyCount >= MAX_TIMELINE_EMPTY_EVENTS) break outer;
          }
        }
      }
    }

    return { events: sortTimelineEvents(events) };
  } catch (e) {
    console.error(e);
    return {
      events: [],
      error: e instanceof Error ? e.message : "Veri yüklenemedi",
    };
  }
}

function normalizeTimeForEvent(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!m) return raw.trim().slice(0, 8);
  return `${m[1].padStart(2, "0")}:${m[2]}:00`;
}

/** Yönetici: tatil / izin kaydı oluşturma veya silme. */
export async function manageStaffTimeOff(input: ManageStaffTimeOffInput) {
  const session = await requireSession();
  if (session.role !== "admin") {
    throw new Error("Bu işlem için yönetici olmalısınız.");
  }

  const supabase = await createClient();

  if (input.action === "delete") {
    const { error } = await supabase
      .from("staff_time_off")
      .delete()
      .eq("id", input.id);
    if (error) {
      if (isPgrstRelationNotFound(error, "staff_time_off")) {
        throw new Error(
          "Veritabanında personel izin tablosu yok. Supabase SQL düzenleyicisinde `supabase/migrations/20260506000000_staff_time_off_and_search.sql` dosyasını çalıştırın."
        );
      }
      throw error;
    }
    revalidatePath("/appointments");
    revalidatePath("/settings");
    return;
  }

  const startMin = parseTimeToMinutesFromMidnight(input.start_time);
  const endMin = parseTimeToMinutesFromMidnight(input.end_time);
  if (endMin <= startMin) {
    throw new Error("Bitiş saati başlangıçtan sonra olmalıdır.");
  }

  const { error } = await supabase.from("staff_time_off").insert({
    staff_id: input.staff_id,
    date: input.date,
    start_time: toPgTime(input.start_time),
    end_time: toPgTime(input.end_time),
    type: input.type,
    reason: input.reason?.trim() ? input.reason.trim() : null,
  });

  if (error) {
    if (isPgrstRelationNotFound(error, "staff_time_off")) {
      throw new Error(
        "Veritabanında personel izin tablosu yok. Supabase SQL düzenleyicisinde `supabase/migrations/20260506000000_staff_time_off_and_search.sql` dosyasını çalıştırın."
      );
    }
    throw error;
  }
  revalidatePath("/appointments");
  revalidatePath("/settings");
}
