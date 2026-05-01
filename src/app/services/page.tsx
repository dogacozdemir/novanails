import type { Metadata } from "next";
import { Suspense } from "react";

import { listServices } from "@/app/services/actions";
import { listStaff } from "@/app/staff/actions";
import { ManagementWorkspace } from "@/components/services/management-workspace";

export const metadata: Metadata = {
  title: "Salon ayarları",
};

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const initialTab = sp.tab === "staff" ? "staff" : "services";

  const [raw, staffRows] = await Promise.all([listServices(), listStaff()]);

  const initialServices = raw.map((s) => ({
    id: s.id,
    name: s.name,
    price: s.price != null ? Number(s.price) : null,
    duration: s.duration != null ? Number(s.duration) : null,
  }));

  return (
    <div className="pb-8 pt-4">
      <Suspense
        fallback={
          <div className="mx-auto max-w-4xl animate-pulse px-4 pt-6 sm:px-6 lg:px-8">
            <div className="glass-nav h-48 rounded-3xl" />
          </div>
        }
      >
        <ManagementWorkspace
          initialTab={initialTab}
          initialServices={initialServices}
          initialStaff={staffRows}
        />
      </Suspense>
    </div>
  );
}
