import type { Metadata } from "next";

import { listCustomers } from "@/app/customers/actions";
import { CustomersList } from "@/components/customers/customers-list";

export const metadata: Metadata = {
  title: "Müşteriler",
};

export default async function CustomersPage() {
  const customers = await listCustomers();

  return (
    <div className="pb-8 pt-4">
      <CustomersList customers={customers} />
    </div>
  );
}
