/** Ayarlar sayfası sekmeleri — ?tab= parametresi (varsayılan: services). */
export type SettingsTab = "services" | "staff" | "timeoff" | "setup";

export const SETTINGS_TABS: readonly (readonly [SettingsTab, string])[] = [
  ["services", "Hizmetler"],
  ["staff", "Uzmanlar"],
  ["timeoff", "İzin & Tatil"],
  ["setup", "Kurulum"],
];

export function parseSettingsTab(
  raw: string | string[] | undefined
): SettingsTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const hit = SETTINGS_TABS.find(([id]) => id === v);
  return hit ? hit[0] : "services";
}
