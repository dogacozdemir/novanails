"use server";

import { getSessionProfile } from "@/lib/auth/session-profile";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { expenseCategoryLabel } from "@/lib/expense-category-labels";
import { addMoney, subtractMoney, sumMoney } from "@/lib/money";
import {
  dayRecordedRangeUtc,
  istanbulDateISO,
  monthExpenseDateRange,
  monthRecordedRangeUtc,
  previousMonthISO,
} from "@/lib/time";
import type { ExpenseCategory } from "@/types/database";

export type StaffSlice = {
  staffId: string;
  name: string;
  value: number;
  fill: string;
};

export type TodayTaskLine = {
  label: string;
  count: number;
};

export type FinanceTotals = {
  revenue: number;
  expenses: number;
  net: number;
};

export type ExpenseCategorySlice = {
  category: ExpenseCategory;
  name: string;
  value: number;
  fill: string;
};

const EXPENSE_SLICE_COLORS: Record<ExpenseCategory, string> = {
  rent: "#d97706",
  staff: "#7c3aed",
  office: "#64748b",
  food: "#ea580c",
  stationery: "#0891b2",
  supplies: "#e11d48",
  other: "#71717a",
};

async function fetchMonthlyFinanceTotals(monthISO: string): Promise<FinanceTotals> {
  const supabase = await createClient();
  const { startIso, endIso } = monthRecordedRangeUtc(monthISO);
  const { start: expStart, end: expEnd } = monthExpenseDateRange(monthISO);

  const [{ data: revRows, error: rErr }, { data: expRows, error: eErr }] =
    await Promise.all([
      supabase
        .from("revenue_entries")
        .select("amount")
        .gte("recorded_at", startIso)
        .lt("recorded_at", endIso),
      supabase
        .from("expenses")
        .select("amount")
        .gte("expense_date", expStart)
        .lte("expense_date", expEnd),
    ]);

  if (rErr) throw rErr;
  if (eErr) throw eErr;

  const revenue = sumMoney((revRows ?? []).map((r) => Number(r.amount)));
  const expenses = sumMoney((expRows ?? []).map((r) => Number(r.amount)));

  return {
    revenue,
    expenses,
    net: subtractMoney(revenue, expenses),
  };
}

export async function getMonthlyFinance(monthISO: string): Promise<FinanceTotals> {
  await requireAdmin();
  return fetchMonthlyFinanceTotals(monthISO);
}

/** Seçilen takvim günü için gelir kayıtları toplamı (Günlük Ciro). */
export async function getDailyRevenueTotal(dateISO: string): Promise<number> {
  await requireAdmin();
  const supabase = await createClient();
  const { startIso, endIso } = dayRecordedRangeUtc(dateISO);

  const { data: rows, error } = await supabase
    .from("revenue_entries")
    .select("amount")
    .gte("recorded_at", startIso)
    .lt("recorded_at", endIso);

  if (error) throw error;
  return sumMoney((rows ?? []).map((r) => Number(r.amount)));
}

/** Seçilen ay ve bir önceki ay — KPI kartları için gerçek MoM karşılaştırması. */
export async function getMonthlyFinanceWithComparison(monthISO: string): Promise<{
  current: FinanceTotals;
  previous: FinanceTotals;
}> {
  await requireAdmin();
  const prevISO = previousMonthISO(monthISO);
  const [current, previous] = await Promise.all([
    fetchMonthlyFinanceTotals(monthISO),
    fetchMonthlyFinanceTotals(prevISO),
  ]);
  return { current, previous };
}

/** Ay içi giderlerin kategori bazlı toplamı (dashboard donut). */
export async function getExpenseBreakdownByCategory(
  monthISO: string
): Promise<ExpenseCategorySlice[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { start: expStart, end: expEnd } = monthExpenseDateRange(monthISO);

  const { data: rows, error } = await supabase
    .from("expenses")
    .select("category, amount")
    .gte("expense_date", expStart)
    .lte("expense_date", expEnd);

  if (error) throw error;

  const totals: Partial<Record<ExpenseCategory, number>> = {};
  for (const r of rows ?? []) {
    const c = r.category as ExpenseCategory;
    totals[c] = addMoney(totals[c] ?? 0, Number(r.amount));
  }

  return (Object.entries(totals) as [ExpenseCategory, number][])
    .filter(([, value]) => value > 0)
    .map(([category, value]) => ({
      category,
      name: expenseCategoryLabel(category),
      value,
      fill: EXPENSE_SLICE_COLORS[category],
    }))
    .sort((a, b) => b.value - a.value);
}

export async function getStaffRevenuePie(monthISO: string): Promise<StaffSlice[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { startIso, endIso } = monthRecordedRangeUtc(monthISO);

  const { data: rev, error: revErr } = await supabase
    .from("revenue_entries")
    .select("amount, appointment_id")
    .gte("recorded_at", startIso)
    .lt("recorded_at", endIso);

  if (revErr) throw revErr;
  if (!rev?.length) return [];

  const apptIds = Array.from(new Set(rev.map((r) => r.appointment_id)));

  const { data: appts, error: apErr } = await supabase
    .from("appointments")
    .select("id, staff_id")
    .in("id", apptIds);

  if (apErr) throw apErr;

  const apptStaff = Object.fromEntries(
    (appts ?? []).map((a) => [a.id, a.staff_id as string])
  );

  const totals: Record<string, number> = {};
  for (const row of rev) {
    const sid = apptStaff[row.appointment_id];
    if (!sid) continue;
    totals[sid] = addMoney(totals[sid] ?? 0, Number(row.amount));
  }

  const staffIds = Array.from(new Set(Object.keys(totals)));
  if (!staffIds.length) return [];

  const { data: staffRows, error: sErr } = await supabase
    .from("staff")
    .select("id, name, color_code")
    .in("id", staffIds);

  if (sErr) throw sErr;

  const hexOk = (c: string) => /^#[0-9A-Fa-f]{6}$/.test(c.trim());

  return (staffRows ?? []).map((s) => ({
    staffId: s.id,
    name: s.name,
    value: totals[s.id] ?? 0,
    fill: hexOk(s.color_code) ? s.color_code : "#94a3b8",
  }));
}

export async function getTodayWorkload(): Promise<TodayTaskLine[]> {
  const supabase = await createClient();
  const session = await getSessionProfile();
  const todayIso = istanbulDateISO();

  let query = supabase
    .from("appointments")
    .select("service_id")
    .eq("appointment_date", todayIso)
    .in("status", ["waiting", "message_sent", "confirmed"]);

  if (session?.role === "staff") {
    if (!session.staffId) return [];
    query = query.eq("staff_id", session.staffId);
  }

  const { data: rows, error } = await query;

  if (error) throw error;

  const appts = rows ?? [];
  if (!appts.length) return [];

  const svcIds = Array.from(new Set(appts.map((a) => a.service_id)));

  const { data: svcRows, error: svcErr } = await supabase
    .from("services")
    .select("id, name")
    .in("id", svcIds);

  if (svcErr) throw svcErr;

  const nameById = Object.fromEntries((svcRows ?? []).map((s) => [s.id, s.name]));

  const counts = new Map<string, number>();
  for (const row of appts) {
    const name = nameById[row.service_id]?.trim() || "Hizmet";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
