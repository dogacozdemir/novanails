/**
 * TRY tutarları için kuruş (minor) birimi ile toplama — JS float sapmasını önler.
 * Kaynak değerler veritabanından numeric olarak geldiği için iki ondalıkla uyumludur.
 */

function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100 + Number.EPSILON);
}

function fromMinorUnits(minor: number): number {
  return minor / 100;
}

/** Birden fazla tutarı güvenli şekilde toplar. */
export function sumMoney(amounts: number[]): number {
  let total = 0;
  for (let i = 0; i < amounts.length; i++) {
    total += toMinorUnits(amounts[i]);
  }
  return fromMinorUnits(total);
}

/** İki toplam arasındaki fark (ör. net kar). */
export function subtractMoney(a: number, b: number): number {
  return fromMinorUnits(toMinorUnits(a) - toMinorUnits(b));
}

/** Formdan gelen tutarı iki ondalığa sabitler (para birimi girişi). */
export function roundMoney(amount: number): number {
  return fromMinorUnits(toMinorUnits(amount));
}

/** İki tutarı güvenli şekilde toplar (işlem sırası için). */
export function addMoney(a: number, b: number): number {
  return fromMinorUnits(toMinorUnits(a) + toMinorUnits(b));
}
