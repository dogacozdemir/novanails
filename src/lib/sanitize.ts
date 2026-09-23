/**
 * Sunucu tarafı metin girdisi — XSS için yüzeyleri daraltır (HTML etiketi kabul etmez).
 * Supabase parametreli sorgular SQL injection’a karşı korur; bu katman ek olarak metni normalize eder.
 */

const HTML_TAG = /<[^>]*>/g;

export function stripHtmlTags(input: string): string {
  return input.replace(HTML_TAG, "");
}

export function sanitizePlainText(
  input: string | null | undefined,
  maxLen: number
): string {
  const s = stripHtmlTags((input ?? "").trim()).replace(/\s+/g, " ");
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function sanitizeOptionalNotes(
  input: string | null | undefined,
  maxLen: number
): string | null {
  const s = sanitizePlainText(input, maxLen);
  return s.length ? s : null;
}

/** Müşteri adı/soyadı — HTML etiketleri kaldırılır; uzunluk sınırlanır. */
export function sanitizePersonName(input: string, maxLen: number): string {
  const s = stripHtmlTags(input.trim()).replace(/\s+/g, " ");
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export const LIMITS = {
  personName: 80,
  phone: 32,
  notes: 8000,
  appointmentNotes: 4000,
  staffNotes: 4000,
  expenseDescription: 2000,
  serviceName: 160,
  staffName: 120,
  staffColorCode: 16,
  paymentCorrectionReason: 1000,
} as const;
