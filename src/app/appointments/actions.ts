"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/money";
import {
  LIMITS,
  sanitizeOptionalNotes,
} from "@/lib/sanitize";
import { findStaffOverlapMinutes } from "@/lib/appointment-overlap";
import { APPOINTMENT_OVERLAP_ERROR } from "@/lib/appointment-errors";
import { istanbulDateISO, parseTimeToMinutesFromMidnight } from "@/lib/time";
import { getSessionProfile, requireSession } from "@/lib/auth/session-profile";
import type { AppointmentStatus, PaymentMethod } from "@/types/database";

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

  const plannedMinutes = Math.max(
    1,
    Math.round(input.planned_duration ?? 120)
  );

  const { data: newSvc, error: nsErr } = await supabase
    .from("services")
    .select("duration")
    .eq("id", input.service_id)
    .single();

  if (nsErr || !newSvc) throw nsErr ?? new Error("Hizmet bulunamadı.");

  const svcDur =
    newSvc.duration != null ? Math.max(1, Number(newSvc.duration)) : null;
  const newDurationMinutes =
    plannedMinutes > 0 ? plannedMinutes : svcDur ?? 120;

  const newStartMinutes = parseTimeToMinutesFromMidnight(pgTime);

  const { data: existingRows, error: listErr } = await supabase
    .from("appointments")
    .select("appointment_time, service_id, planned_duration")
    .eq("staff_id", effectiveStaffId)
    .eq("appointment_date", input.appointment_date)
    .neq("status", "cancelled");

  if (listErr) throw listErr;

  const svcIds = Array.from(
    new Set((existingRows ?? []).map((r) => r.service_id as string))
  );
  let durByService: Record<string, number> = {};
  if (svcIds.length > 0) {
    const { data: durRows, error: durErr } = await supabase
      .from("services")
      .select("id, duration")
      .in("id", svcIds);
    if (durErr) throw durErr;
    durByService = Object.fromEntries(
      (durRows ?? []).map((s) => [
        s.id as string,
        s.duration != null ? Math.max(1, Number(s.duration)) : 120,
      ])
    );
  }

  const existing = (existingRows ?? []).map((r) => {
    const planned = r.planned_duration != null ? Number(r.planned_duration) : null;
    const fallbackSvc = durByService[r.service_id as string] ?? 120;
    const durationMinutes =
      planned != null && planned > 0 ? planned : fallbackSvc;
    return {
      appointment_time: String(r.appointment_time),
      durationMinutes,
    };
  });

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
      throw new Error(
        "Bu uzman için aynı başlangıç saatinde başka bir randevu var."
      );
    }
    throw error;
  }
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
}

export async function updateAppointmentTimeAndNotes(
  appointmentId: string,
  input: {
    appointment_time?: string;
    notes?: string | null;
  }
) {
  const supabase = await createClient();
  const session = await requireSession();

  const { data: row, error: fetchErr } = await supabase
    .from("appointments")
    .select(
      "id, staff_id, appointment_date, appointment_time, status, planned_duration, service_id"
    )
    .eq("id", appointmentId)
    .single();

  if (fetchErr || !row) throw fetchErr ?? new Error("Randevu bulunamadı.");

  const status = row.status as AppointmentStatus;

  if (session.role === "staff") {
    if (!session.staffId || row.staff_id !== session.staffId) {
      throw new Error("Bu randevuyu düzenleyemezsiniz.");
    }
    if (status === "completed" || status === "cancelled") {
      throw new Error(
        "Tamamlanan veya iptal edilmiş randevuları düzenleyemezsiniz."
      );
    }
  }

  if (status === "cancelled") {
    throw new Error("İptal edilmiş randevu düzenlenemez.");
  }

  const updates: {
    notes?: string | null;
    appointment_time?: string;
  } = {};

  if (input.notes !== undefined) {
    updates.notes = sanitizeOptionalNotes(
      input.notes,
      LIMITS.appointmentNotes
    );
  }

  if (input.appointment_time !== undefined) {
    const pgTime = toPgTime(input.appointment_time);

    const plannedMinutes =
      row.planned_duration != null ? Number(row.planned_duration) : 120;
    const newDurationMinutes = Math.max(1, Math.round(plannedMinutes));

    const newStartMinutes = parseTimeToMinutesFromMidnight(pgTime);

    const { data: existingRows, error: listErr } = await supabase
      .from("appointments")
      .select("id, appointment_time, service_id, planned_duration")
      .eq("staff_id", row.staff_id as string)
      .eq("appointment_date", row.appointment_date as string)
      .neq("status", "cancelled")
      .neq("id", appointmentId);

    if (listErr) throw listErr;

    const svcIds = Array.from(
      new Set(
        (existingRows ?? []).map((r) => r.service_id as string).filter(Boolean)
      )
    );
    let durByService: Record<string, number> = {};
    if (svcIds.length > 0) {
      const { data: durRows, error: durErr } = await supabase
        .from("services")
        .select("id, duration")
        .in("id", svcIds);
      if (durErr) throw durErr;
      durByService = Object.fromEntries(
        (durRows ?? []).map((s) => [
          s.id as string,
          s.duration != null ? Math.max(1, Number(s.duration)) : 120,
        ])
      );
    }

    const existing = (existingRows ?? []).map((r) => {
      const planned = r.planned_duration != null ? Number(r.planned_duration) : null;
      const fallbackSvc = durByService[r.service_id as string] ?? 120;
      const durationMinutes =
        planned != null && planned > 0 ? planned : fallbackSvc;
      return {
        appointment_time: String(r.appointment_time),
        durationMinutes,
      };
    });

    if (
      findStaffOverlapMinutes({
        newStartMinutes,
        newDurationMinutes,
        existing,
      })
    ) {
      throw new Error(APPOINTMENT_OVERLAP_ERROR);
    }

    updates.appointment_time = pgTime;
  }

  if (Object.keys(updates).length === 0) return;

  const { error: updErr } = await supabase
    .from("appointments")
    .update(updates)
    .eq("id", appointmentId);

  if (updErr) throw updErr;

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
