"use client";

import Phone from "lucide-react/dist/esm/icons/phone.mjs";
import Search from "lucide-react/dist/esm/icons/search.mjs";
import User from "lucide-react/dist/esm/icons/user.mjs";
import UserPlus from "lucide-react/dist/esm/icons/user-plus.mjs";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import type { CustomerRow } from "@/app/customers/actions";
import { CustomerQuickAddDialog } from "@/components/customers/customer-quick-add-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function normalizeDigits(p: string) {
  return p.replace(/\D/g, "");
}

function CustomersHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="liquid-glass-v2 shadow-diffuse flex flex-col gap-4 rounded-[1.75rem] px-5 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Kayıtlar
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
          Müşteriler
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ada veya telefon ile anında ara.
        </p>
      </div>
      {children}
    </header>
  );
}

type Props = {
  customers: CustomerRow[];
};

export function CustomersList({ customers }: Props) {
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const dg = normalizeDigits(q);
    if (!s && !dg) return customers;
    return customers.filter((c) => {
      const full = `${c.name} ${c.surname}`.toLowerCase();
      const phone = normalizeDigits(c.phone ?? "");
      const phoneHit =
        dg.length >= 3 &&
        (phone.includes(dg) || phone.endsWith(dg.slice(-10)));
      return full.includes(s) || phoneHit;
    });
  }, [customers, q]);

  const addButton = (
    <Button
      type="button"
      className="h-11 shrink-0 gap-2 rounded-xl shadow-diffuse sm:self-start"
      onClick={() => setCreateOpen(true)}
    >
      <UserPlus className="size-4" strokeWidth={2} />
      Yeni Müşteri Ekle
    </Button>
  );

  if (customers.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 md:pb-16 lg:px-8">
        <CustomersHeader>{addButton}</CustomersHeader>
        <div className="liquid-glass-v2 shadow-diffuse rounded-[1.75rem] px-2 py-4">
          <EmptyState
            title="Henüz bir kayıt yok"
            description="Henüz müşteri eklenmemiş. Randevu oluştururken veya yukarıdaki düğme ile kayıt ekleyerek başlayın."
          />
        </div>
        <CustomerQuickAddDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 md:pb-16 lg:px-8">
      <CustomersHeader>{addButton}</CustomersHeader>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ad veya telefon…"
          className={cn(
            "liquid-glass-v2 h-12 rounded-2xl border-transparent pl-11 pr-4 text-base shadow-diffuse",
            "backdrop-blur-xl focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35"
          )}
          aria-label="Müşteri ara"
        />
      </div>

      <div className="liquid-glass-v2 shadow-diffuse overflow-hidden rounded-[1.75rem]">
        <ul className="flex flex-col gap-0 divide-y divide-black/[0.055] dark:divide-white/[0.07]">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/customers/${c.id}`}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 transition-colors",
                  "hover:bg-black/[0.035] dark:hover:bg-white/[0.05]"
                )}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-primary/10 text-primary ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
                  <User className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {c.name} {c.surname}
                  </p>
                  {c.phone ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="size-3 shrink-0" />
                      {c.phone}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Telefon yok
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Aramanızla eşleşen kayıt yok.
        </p>
      ) : null}

      <CustomerQuickAddDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
