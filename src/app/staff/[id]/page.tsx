import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getStaffPerformance } from "@/app/staff/actions";
import { StaffPerformanceView } from "@/components/staff/staff-performance-view";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { STAFF_PERIOD_PARAM, parseStaffPeriod } from "@/lib/staff-period";
import { istanbulYearMonthISO } from "@/lib/time";

export const metadata: Metadata = {
  title: "Çalışan",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StaffDetailPage({ params, searchParams }: Props) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/appointments");

  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();

  const currentMonthISO = istanbulYearMonthISO();
  const period = parseStaffPeriod(sp[STAFF_PERIOD_PARAM], currentMonthISO);
  const data = await getStaffPerformance(id, period);
  if (!data) notFound();

  return (
    <StaffPerformanceView
      data={data}
      period={period}
      currentMonthISO={currentMonthISO}
    />
  );
}
