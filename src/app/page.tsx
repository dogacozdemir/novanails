import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/session-profile";

/** Alan adı kökü — middleware çoğu isteği yakalar; bu yedek sunucu yönlendirmesi. */
export default async function HomePage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  redirect("/dashboard");
}
