import type { Metadata } from "next";

import { ConfirmationQueue } from "@/components/appointments/confirmation-queue";
import { getSessionProfile } from "@/lib/auth/session-profile";

export const metadata: Metadata = {
  title: "Randevu teyit",
};

export default async function AppointmentConfirmPage() {
  const profile = await getSessionProfile();
  return <ConfirmationQueue sessionRole={profile?.role ?? "staff"} />;
}
