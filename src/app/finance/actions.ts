"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory } from "@/types/database";
import { expenseCategoryLabel } from "@/lib/expense-category-labels";
import { roundMoney, subtractMoney, sumMoney } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/payment-method-labels";
import { summarizeByPaymentMethod } from "@/lib/payment-method-summary";
import {
  LIMITS,
  sanitizeOptionalNotes,
} from "@/lib/sanitize";
import {
  monthExpenseDateRange,
  monthRecordedRangeUtc,
} from "@/lib/time";

export type ExpenseRow = {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  category_label: string;
  amount: number;
  description: string | null;
};

export async function listExpenses(monthISO: string): Promise<ExpenseRow[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { start, end } = monthExpenseDateRange(monthISO);

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .gte("expense_date", start)
    .lte("expense_date", end)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    expense_date: r.expense_date,
    category: r.category as ExpenseCategory,
    category_label: expenseCategoryLabel(r.category as ExpenseCategory),
    amount: Number(r.amount),
    description: r.description,
  }));
}

export async function createExpense(input: {
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  description?: string | null;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const amount = roundMoney(input.amount);
  const description = sanitizeOptionalNotes(
    input.description,
    LIMITS.expenseDescription
  );
  const { error } = await supabase.from("expenses").insert({
    expense_date: input.expense_date,
    category: input.category,
    amount,
    description,
  });
  if (error) throw error;
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

export async function getMonthlyExportPayload(monthISO: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { startIso, endIso } = monthRecordedRangeUtc(monthISO);
  const { start: expStart, end: expEnd } = monthExpenseDateRange(monthISO);

  const [{ data: revenues }, { data: expenseRows }] = await Promise.all([
    supabase
      .from("revenue_entries")
      .select("amount, recorded_at, appointment_id, note, payment_method")
      .gte("recorded_at", startIso)
      .lt("recorded_at", endIso)
      .order("recorded_at", { ascending: true }),
    supabase
      .from("expenses")
      .select("expense_date, category, amount, description")
      .gte("expense_date", expStart)
      .lte("expense_date", expEnd)
      .order("expense_date", { ascending: true }),
  ]);

  const revSum = sumMoney((revenues ?? []).map((r) => Number(r.amount)));
  const expSum = sumMoney((expenseRows ?? []).map((r) => Number(r.amount)));
  const byMethod = summarizeByPaymentMethod(revenues ?? []);

  return {
    monthISO,
    revenues: (revenues ?? []).map((r) => ({
      tarih: r.recorded_at?.slice(0, 19).replace("T", " ") ?? "",
      tutar: Number(r.amount),
      odeme_yontemi: paymentMethodLabel(r.payment_method),
      randevu_id: r.appointment_id,
      not: r.note ?? "",
    })),
    odeme_yontemleri: byMethod.slices.map((s) => ({
      yontem: s.label,
      islem_sayisi: s.count,
      tutar: s.amount,
    })),
    expenses: (expenseRows ?? []).map((r) => ({
      tarih: r.expense_date,
      kategori: expenseCategoryLabel(r.category as ExpenseCategory),
      tutar: Number(r.amount),
      aciklama: r.description ?? "",
    })),
    ozet: {
      toplam_ciro: revSum,
      toplam_gider: expSum,
      net_kar: subtractMoney(revSum, expSum),
    },
  };
}
