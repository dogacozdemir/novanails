import type { PaymentMethod } from "@/types/database";

/** Ödeme kanalı etiketleri — İşlemi Bitir penceresindeki seçeneklerle aynı. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Nakit",
  credit_card: "Kredi kartı",
  iban: "Havale / IBAN",
};

/** Sabit sıralama (rapor ve seçim listeleri). */
export const PAYMENT_METHOD_ORDER: PaymentMethod[] = [
  "cash",
  "credit_card",
  "iban",
];

/** Yöntemi kaydedilmemiş eski / elle tamamlanmış randevular için. */
export const PAYMENT_METHOD_UNKNOWN_LABEL = "Belirtilmemiş";

export function paymentMethodLabel(
  method: PaymentMethod | null | undefined
): string {
  return method ? PAYMENT_METHOD_LABELS[method] : PAYMENT_METHOD_UNKNOWN_LABEL;
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "cash" || value === "credit_card" || value === "iban";
}
