"use server";

import { revalidatePath } from "next/cache";

import { getSessionProfile, requireSession } from "@/lib/auth/session-profile";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus, PaymentMethod } from "@/types/database";
import { sumMoney } from "@/lib/money";
import {
  LIMITS,
  sanitizeOptionalNotes,
  sanitizePersonName,
  sanitizePlainText,
} from "@/lib/sanitize";

export type CustomerRow = {
  id: string;
  name: string;
  surname: string;
  phone: string | null;
  notes: string | null;
};

async function staffScopedCustomerIds(
  staffId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("customer_id")
    .eq("staff_id", staffId);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.customer_id as string))];
}

export async function listCustomers(): Promise<CustomerRow[]> {
  await requireSession();
  const supabase = await createClient();
  const session = await getSessionProfile();

  if (session?.role === "staff") {
    if (!session.staffId) return [];
    const ids = await staffScopedCustomerIds(session.staffId, supabase);
    if (!ids.length) return [];
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, surname, phone, notes")
      .in("id", ids)
      .order("surname", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CustomerRow[];
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, name, surname, phone, notes")
    .order("surname", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CustomerRow[];
}

export async function createCustomer(input: {
  name: string;
  surname: string;
  phone?: string | null;
  notes?: string | null;
}) {
  await requireSession();
  const supabase = await createClient();
  const name = sanitizePersonName(input.name, LIMITS.personName);
  const surname = sanitizePersonName(input.surname, LIMITS.personName);
  const raw = sanitizePlainText(input.phone ?? "", LIMITS.phone);
  const digitsOnly = raw.replace(/\D/g, "").slice(0, 15);
  const phone = digitsOnly.length ? digitsOnly : null;
  const notes = sanitizeOptionalNotes(input.notes, LIMITS.notes);

  if (!name.length || !surname.length) {
    throw new Error("Geçerli ad ve soyad girin.");
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      name,
      surname,
      phone: phone?.length ? phone : null,
      notes,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/customers");
  revalidatePath("/appointments");
  return { id: data.id as string };
}

export async function updateCustomerProfileNotes(
  customerId: string,
  notes: string | null
) {
  const session = await requireSession();
  const supabase = await createClient();
  if (session.role === "staff") {
    if (!session.staffId) {
      throw new Error("Hesabınız henüz bir uzman ile eşleştirilmedi.");
    }
    const scoped = await staffScopedCustomerIds(session.staffId, supabase);
    if (!scoped.includes(customerId)) {
      throw new Error("Bu müşteri için yetkiniz yok.");
    }
  }
  const cleaned = sanitizeOptionalNotes(notes, LIMITS.notes);
  const { error } = await supabase
    .from("customers")
    .update({ notes: cleaned })
    .eq("id", customerId);
  if (error) throw error;
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/appointments");
}

export type HistoryAppointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  staff_name: string;
  service_name: string;
  service_price: number;
  paid_amount: number | null;
  /** Tamamlamada seçilen ödeme kanalı — appointments.payment_method */
  payment_method: PaymentMethod | null;
  /** Randevuya özel not — appointments.notes */
  appointment_notes: string | null;
};

export async function getCustomerWithHistory(customerId: string): Promise<{
  customer: CustomerRow | null;
  appointments: HistoryAppointment[];
  totalPaid: number;
  financeHidden: boolean;
}> {
  const session = await requireSession();
  const supabase = await createClient();
  const staffScope =
    session.role === "staff" ? session.staffId ?? null : null;
  const financeHidden = session.role === "staff";

  const { data: customer, error: cErr } = await supabase
    .from("customers")
    .select("id, name, surname, phone, notes")
    .eq("id", customerId)
    .maybeSingle();

  if (cErr) throw cErr;
  if (!customer) return { customer: null, appointments: [], totalPaid: 0, financeHidden };

  if (staffScope) {
    const { data: link, error: linkErr } = await supabase
      .from("appointments")
      .select("id")
      .eq("customer_id", customerId)
      .eq("staff_id", staffScope)
      .limit(1)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) return { customer: null, appointments: [], totalPaid: 0, financeHidden };
  }

  let apptQuery = supabase
    .from("appointments")
    .select(
      "id, appointment_date, appointment_time, status, staff_id, service_id, notes, payment_method"
    )
    .eq("customer_id", customerId);

  if (staffScope) {
    apptQuery = apptQuery.eq("staff_id", staffScope);
  }

  const { data: rawAppts, error: aErr } = await apptQuery;

  if (aErr) throw aErr;

  const appts = rawAppts ?? [];
  const staffIds = Array.from(new Set(appts.map((a) => a.staff_id)));
  const serviceIds = Array.from(new Set(appts.map((a) => a.service_id)));
  const apptIds = appts.map((a) => a.id);

  let staffRows: { id: string; name: string }[] = [];
  if (staffIds.length) {
    const { data, error } = await supabase
      .from("staff")
      .select("id, name")
      .in("id", staffIds);
    if (error) throw error;
    staffRows = data ?? [];
  }

  let svcRows: { id: string; name: string; price: number | null }[] = [];
  if (serviceIds.length) {
    const { data, error } = await supabase
      .from("services")
      .select("id, name, price")
      .in("id", serviceIds);
    if (error) throw error;
    svcRows = data ?? [];
  }

  let revRows: { appointment_id: string; amount: number }[] = [];
  if (apptIds.length && !financeHidden) {
    const { data, error } = await supabase
      .from("revenue_entries")
      .select("appointment_id, amount")
      .in("appointment_id", apptIds);
    if (error) throw error;
    revRows = data ?? [];
  }

  const staffMap = Object.fromEntries(staffRows.map((s) => [s.id, s.name]));
  const svcMap = Object.fromEntries(
    svcRows.map((s) => [
      s.id,
      {
        name: s.name,
        price: s.price != null ? Number(s.price) : null,
      },
    ])
  );
  const revenueMap = Object.fromEntries(
    revRows.map((r) => [r.appointment_id, Number(r.amount)])
  );

  const appointments: HistoryAppointment[] = appts.map((row) => {
    const sid = row.staff_id;
    const vf = svcMap[row.service_id];
    const paid = financeHidden ? null : revenueMap[row.id];
    return {
      id: row.id,
      appointment_date: row.appointment_date,
      appointment_time: row.appointment_time,
      status: row.status as AppointmentStatus,
      staff_name: staffMap[sid] ?? "—",
      service_name: vf?.name ?? "—",
      service_price: vf?.price ?? 0,
      paid_amount: paid ?? null,
      payment_method: row.payment_method ?? null,
      appointment_notes: row.notes ?? null,
    };
  });

  appointments.sort((a, b) => {
    const dc = b.appointment_date.localeCompare(a.appointment_date);
    if (dc !== 0) return dc;
    const ta = String(a.appointment_time).slice(0, 8);
    const tb = String(b.appointment_time).slice(0, 8);
    return tb.localeCompare(ta);
  });

  const totalPaid = financeHidden ? 0 : sumMoney(Object.values(revenueMap));

  return {
    customer: customer as CustomerRow,
    appointments,
    totalPaid,
    financeHidden,
  };
}

export type CustomerHistoryMinimal = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  service_name: string;
  status: AppointmentStatus;
};

function mapCustomerHistoryRows(
  rows: {
    id: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    services: unknown;
  }[]
): CustomerHistoryMinimal[] {
  return rows.map((row) => {
    const svcRaw = row.services;
    const svcRec =
      svcRaw && typeof svcRaw === "object" && svcRaw !== null
        ? (svcRaw as { name?: string })
        : null;
    return {
      id: row.id,
      appointment_date: row.appointment_date,
      appointment_time: row.appointment_time,
      service_name: svcRec?.name?.trim() || "—",
      status: row.status as AppointmentStatus,
    };
  });
}

async function assertCustomerHistoryAccess(
  customerId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffScope: string | null
) {
  if (!staffScope) return;
  const { data: link, error: linkErr } = await supabase
    .from("appointments")
    .select("id")
    .eq("customer_id", customerId)
    .eq("staff_id", staffScope)
    .limit(1)
    .maybeSingle();
  if (linkErr) throw linkErr;
  if (!link) throw new Error("Bu müşteri için yetkiniz yok.");
}

/** Randevu detay sayfası için en fazla 5 son randevu (geçmiş + yaklaşan). */
export async function getCustomerRecentHistoryMinimal(
  customerId: string,
  excludeAppointmentId?: string
): Promise<CustomerHistoryMinimal[]> {
  await requireSession();
  const supabase = await createClient();
  const session = await getSessionProfile();
  const staffScope =
    session?.role === "staff" ? session.staffId ?? null : null;

  try {
    await assertCustomerHistoryAccess(customerId, supabase, staffScope);
  } catch {
    return [];
  }

  let apptQuery = supabase
    .from("appointments")
    .select(
      "id, appointment_date, appointment_time, status, services ( name )"
    )
    .eq("customer_id", customerId)
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false })
    .limit(excludeAppointmentId ? 6 : 5);

  if (staffScope) {
    apptQuery = apptQuery.eq("staff_id", staffScope);
  }

  const { data: rows, error } = await apptQuery;
  if (error) throw error;

  return mapCustomerHistoryRows(rows ?? [])
    .filter((r) => r.id !== excludeAppointmentId)
    .slice(0, 5);
}

/** Müşterinin tüm randevuları — detay panelinde isme tıklanınca (mevcut dahil). */
export async function getCustomerFullAppointmentHistory(
  customerId: string
): Promise<CustomerHistoryMinimal[]> {
  await requireSession();
  const supabase = await createClient();
  const session = await getSessionProfile();
  const staffScope =
    session?.role === "staff" ? session.staffId ?? null : null;

  await assertCustomerHistoryAccess(customerId, supabase, staffScope);

  let apptQuery = supabase
    .from("appointments")
    .select(
      "id, appointment_date, appointment_time, status, services ( name )"
    )
    .eq("customer_id", customerId)
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false });

  if (staffScope) {
    apptQuery = apptQuery.eq("staff_id", staffScope);
  }

  const { data: rows, error } = await apptQuery;
  if (error) throw error;
  return mapCustomerHistoryRows(rows ?? []);
}
