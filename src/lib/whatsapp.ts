import { LIMITS, sanitizePersonName } from "@/lib/sanitize";

/**
 * Mobil ve masaüstü için `tel:` URI — rakamlar WhatsApp ile uyumlu normalize edilir.
 */
export function buildTelHref(
  phoneRaw: string | null | undefined
): string | null {
  if (!phoneRaw?.trim()) return null;

  const digits = phoneRaw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length >= 12) {
    return `tel:+${digits}`;
  }
  if (digits.startsWith("0") && digits.length >= 11) {
    return `tel:+90${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `tel:+90${digits}`;
  }
  if (digits.length >= 11) {
    return `tel:+${digits}`;
  }
  return null;
}

/** Türkiye için WhatsApp bağlantısı — müşteri telefonundan rakamlar çıkarılır. */

export function buildWhatsAppConfirmationLink(
  phoneRaw: string | null | undefined,
  firstNameRaw: string,
  dateLabel: string,
  timeLabel: string
): string | null {
  if (!phoneRaw?.trim()) return null;

  const firstName =
    sanitizePersonName(firstNameRaw || "Misafir", LIMITS.personName) || "Misafir";

  let digits = phoneRaw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length >= 12) {
    /* ok */
  } else if (digits.startsWith("0") && digits.length >= 11) {
    digits = "90" + digits.slice(1);
  } else if (digits.length === 10) {
    digits = "90" + digits;
  }

  const text = `Merhaba ${firstName}, ${dateLabel} saat ${timeLabel} randevunuzu teyit etmek isteriz.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
