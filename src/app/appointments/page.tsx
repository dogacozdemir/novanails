import type { Metadata } from "next";

import { AppointmentsBoardEntry } from "@/components/appointments/appointments-board-entry";
import { getSessionProfile } from "@/lib/auth/session-profile";

export const metadata: Metadata = {
  title: "Randevular",
};

export default async function AppointmentsPage() {
  const profile = await getSessionProfile();
  return (
    <div className="pb-8 pt-4">
      <AppointmentsBoardEntry sessionRole={profile?.role ?? "staff"} />
    </div>
  );
}
