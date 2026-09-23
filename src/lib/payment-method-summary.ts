import { addMoney, sumMoney } from "@/lib/money";
import {
  PAYMENT_METHOD_ORDER,
  isPaymentMethod,
  paymentMethodLabel,
} from "@/lib/payment-method-labels";
import type { PaymentMethod } from "@/types/database";

export type PaymentMethodSlice = {
  /** null: yöntemi kaydedilmemiş gelir satırları */
  method: PaymentMethod | null;
  label: string;
  amount: number;
  count: number;
};

/**
 * Gelir satırlarını ödeme yöntemine göre toplar.
 * Nakit / Kredi kartı / Havale her zaman döner (0 olsa bile);
 * "Belirtilmemiş" yalnızca bu tür satır varsa eklenir.
 * Dilimlerin toplamı, aynı satırların sumMoney toplamına eşittir.
 */
export function summarizeByPaymentMethod(
  rows: { amount: number | string | null; payment_method: string | null }[]
): { slices: PaymentMethodSlice[]; total: number } {
  const amounts = new Map<PaymentMethod | null, number>();
  const counts = new Map<PaymentMethod | null, number>();

  for (const r of rows) {
    const key = isPaymentMethod(r.payment_method) ? r.payment_method : null;
    amounts.set(key, addMoney(amounts.get(key) ?? 0, Number(r.amount ?? 0)));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const keys: (PaymentMethod | null)[] = [...PAYMENT_METHOD_ORDER];
  if (counts.has(null)) keys.push(null);

  const slices = keys.map((method) => ({
    method,
    label: paymentMethodLabel(method),
    amount: amounts.get(method) ?? 0,
    count: counts.get(method) ?? 0,
  }));

  return {
    slices,
    total: sumMoney(rows.map((r) => Number(r.amount ?? 0))),
  };
}
