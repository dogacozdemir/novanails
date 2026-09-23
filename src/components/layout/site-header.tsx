import Image from "next/image";
import Link from "next/link";

import { MobileNavMenu } from "@/components/layout/mobile-nav-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { buttonVariants } from "@/components/ui/button";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

const allNav: { href: string; label: string; staffHidden?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/finance", label: "Finans", staffHidden: true },
  { href: "/appointments", label: "Randevular" },
  { href: "/appointments/confirm", label: "Teyit" },
  { href: "/customers", label: "Müşteriler" },
  { href: "/staff", label: "Çalışanlar", staffHidden: true },
  { href: "/settings", label: "Ayarlar", staffHidden: true },
];

type SiteHeaderProps = {
  navRole: UserRole | null;
};

export function SiteHeader({ navRole }: SiteHeaderProps) {
  const isStaff = navRole === "staff";
  const nav = isStaff ? allNav.filter((item) => !item.staffHidden) : allNav;

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6 xl:px-10">
      <div
        className={cn(
          "glass-nav mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-3 sm:px-6",
          "transition-glass"
        )}
      >
        <Link
          href="/dashboard"
          className="group flex items-center gap-2 text-[var(--nova-charcoal)] dark:text-foreground"
        >
          <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-inner transition-transform duration-300 group-hover:scale-[1.03]">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={36}
              height={36}
              className="size-9 object-cover"
              sizes="36px"
              priority
            />
          </span>
          <span className="whitespace-nowrap font-heading text-lg font-semibold tracking-tight sm:text-xl">
            Nova Nail Studio
          </span>
        </Link>

        <nav
          className="hidden items-center gap-0.5 lg:flex xl:gap-1"
          aria-label="Ana navigasyon"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium text-foreground/75 transition-colors hover:bg-black/[0.04] hover:text-foreground xl:px-4 dark:hover:bg-white/[0.06]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <UserMenu />
          <Link
            href="/appointments"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "hidden sm:inline-flex"
            )}
          >
            Randevu
          </Link>
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "hidden shadow-glass-inner sm:inline-flex"
            )}
          >
            Başla
          </Link>
          <MobileNavMenu
            items={nav.map(({ href, label }) => ({ href, label }))}
            className="lg:hidden"
          />
        </div>
      </div>
    </header>
  );
}
