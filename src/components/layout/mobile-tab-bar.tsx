"use client";

import CalendarDays from "lucide-react/dist/esm/icons/calendar-days.mjs";
import ClipboardCheck from "lucide-react/dist/esm/icons/clipboard-check.mjs";
import Settings from "lucide-react/dist/esm/icons/settings.mjs";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";
import Users from "lucide-react/dist/esm/icons/users.mjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

const allTabs = [
  { href: "/appointments", label: "Takvim", Icon: CalendarDays, staffHidden: false },
  {
    href: "/appointments/confirm",
    label: "Teyit",
    Icon: ClipboardCheck,
    staffHidden: false,
  },
  { href: "/customers", label: "Müşteriler", Icon: Users, staffHidden: false },
  { href: "/finance", label: "Raporlar", Icon: Sparkles, staffHidden: true },
  { href: "/settings", label: "Ayarlar", Icon: Settings, staffHidden: true },
] as const;

type Props = {
  navRole: UserRole | null;
};

export function MobileTabBar({ navRole }: Props) {
  const pathname = usePathname();
  const isStaff = navRole === "staff";
  const tabs = isStaff ? allTabs.filter((t) => !t.staffHidden) : [...allTabs];

  return (
    <nav
      aria-label="Alt menü"
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2 md:hidden pointer-events-none"
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-1 rounded-[1.35rem] px-2 py-2",
          "will-change-transform border border-white/55 bg-white/80 shadow-[0_-8px_40px_rgb(26_26_26_/8%),0_4px_24px_rgb(26_26_26_/6%)] backdrop-blur-md",
          "dark:border-white/[0.12] dark:bg-zinc-950/78 dark:shadow-black/40"
        )}
      >
        {tabs.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href !== "/appointments" &&
              pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition-colors",
                active
                  ? "text-[var(--nova-charcoal)] dark:text-foreground"
                  : "text-muted-foreground hover:text-foreground/90"
              )}
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-2xl transition-[background,transform]",
                  active
                    ? "bg-primary/12 text-primary shadow-inner ring-1 ring-primary/15"
                    : "bg-transparent"
                )}
              >
                <Icon className="size-[1.15rem]" aria-hidden />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
