import { redirect } from "next/navigation";

/**
 * Eski "Salon ayarları" adresi — hizmet ve uzman yönetimi Ayarlar sayfasına taşındı.
 * Yer imleri bozulmasın diye ilgili sekmeye yönlendirir (?tab=staff korunur).
 */
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  redirect(sp.tab === "staff" ? "/settings?tab=staff" : "/settings?tab=services");
}
