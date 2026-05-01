import Menu from "lucide-react/dist/esm/icons/menu.mjs";
import Image from "next/image";
import Link from "next/link";

import { UserMenu } from "@/components/layout/user-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

const allNav: { href: string; label: string; staffHidden?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/finance", label: "Finans", staffHidden: true },
  { href: "/appointments", label: "Randevular" },
  { href: "/appointments/confirm", label: "Teyit" },
  { href: "/services", label: "Salon ayarları", staffHidden: true },
  { href: "/customers", label: "Müşteriler" },
];

type SiteHeaderProps = {
  navRole: UserRole | null;
};

export function SiteHeader({ navRole }: SiteHeaderProps) {
  const isStaff = navRole === "staff";
  const nav = isStaff ? allNav.filter((item) => !item.staffHidden) : allNav;

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6 lg:px-10">
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
          <span className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
            Nova Nail Studio
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Ana navigasyon"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-foreground/75 transition-colors hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
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
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Menüyü aç"
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
