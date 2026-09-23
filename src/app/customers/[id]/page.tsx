import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getBoardData } from "@/app/appointments/actions";
import { getCustomerWithHistory } from "@/app/customers/actions";
import { CustomerDetailView } from "@/components/customers/customer-detail-view";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { istanbulDateISO } from "@/lib/time";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getCustomerWithHistory(id);
  if (!data.customer) return { title: "Müşteri" };
  const { customer } = data;
  return {
    title: `${customer.name} ${customer.surname}`,
  };
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const [data, board, profile] = await Promise.all([
    getCustomerWithHistory(id),
    getBoardData(istanbulDateISO()),
    getSessionProfile(),
  ]);
  if (!data.customer) notFound();

  return (
    <div className="pb-8 pt-4">
      <CustomerDetailView
        customer={data.customer}
        appointments={data.appointments}
        totalPaid={data.totalPaid}
        financeHidden={data.financeHidden}
        sessionRole={profile?.role ?? "staff"}
        customers={board.customers}
        services={board.services}
        staff={board.staff}
      />
    </div>
  );
}
