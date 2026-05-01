import type { Metadata } from "next";

import { DashboardBoard } from "@/components/dashboard/dashboard-board";
import { getSessionProfile } from "@/lib/auth/session-profile";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  return <DashboardBoard sessionRole={profile?.role ?? "staff"} />;
}
