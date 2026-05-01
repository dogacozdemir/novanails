/**
 * Ortak Nova “Liquid Glass” modal yüzeyleri — İşlemi Bitir / Müşteri / Gider / Randevu oluştur.
 * Tek radius (1.35rem), ring/border ve animasyonlar hizalı.
 */

export const novaDialogAnimateOverlay =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

export const novaDialogAnimateContent =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95";

/** Çoğu sayfa modali — üst katman (SiteShell altında) */
export const NOVA_GLASS_DIALOG_OVERLAY =
  `fixed inset-0 z-[100] bg-black/35 backdrop-blur-md will-change-[opacity] ${novaDialogAnimateOverlay}`;

/** Randevu detayı sheet’inin üstünde açılan modaller (checkout / düzenle) */
export const NOVA_GLASS_DIALOG_OVERLAY_STACKED =
  `fixed inset-0 z-[124] bg-black/35 backdrop-blur-md will-change-[opacity] ${novaDialogAnimateOverlay}`;

/** Standart panel — max genişlik 26rem */
export const NOVA_GLASS_DIALOG_PANEL =
  `liquid-glass-v2 shadow-diffuse fixed left-1/2 top-1/2 z-[101] max-h-[min(92vh,calc(100vh-2rem))] w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[1.35rem] border border-[var(--glass-border)] p-6 shadow-[0_32px_90px_-28px_rgba(0,0,0,0.12)] ring-1 ring-[var(--glass-border)] focus:outline-none dark:border-white/12 ${novaDialogAnimateContent}`;

/** Sheet üstü panel */
export const NOVA_GLASS_DIALOG_PANEL_STACKED =
  `liquid-glass-v2 shadow-diffuse fixed left-1/2 top-1/2 z-[125] max-h-[min(92vh,calc(100vh-2rem))] w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[1.35rem] border border-[var(--glass-border)] p-6 shadow-[0_32px_90px_-28px_rgba(0,0,0,0.12)] ring-1 ring-[var(--glass-border)] focus:outline-none dark:border-white/12 ${novaDialogAnimateContent}`;

export const NOVA_DIALOG_TITLE =
  "font-heading text-lg font-semibold tracking-tight text-[var(--nova-charcoal)] dark:text-foreground";

export const NOVA_DIALOG_DESCRIPTION = "mt-1 text-sm leading-relaxed text-muted-foreground";
