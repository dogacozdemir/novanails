"use client";

import dynamic from "next/dynamic";

import { AppointmentBoardSkeleton } from "@/components/ui/glass-skeleton";
import type { UserRole } from "@/types/database";

const AppointmentsBoard = dynamic(
  () =>
    import("@/components/appointments/appointments-board").then(
      (m) => m.AppointmentsBoard
    ),
  {
    ssr: false,
    loading: () => <AppointmentBoardSkeleton />,
  }
);

export function AppointmentsBoardEntry({
  sessionRole,
}: {
  sessionRole: UserRole;
}) {
  return <AppointmentsBoard sessionRole={sessionRole} />;
}
