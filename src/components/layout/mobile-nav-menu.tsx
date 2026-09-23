"use client";

import Menu from "lucide-react/dist/esm/icons/menu.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

/** /appointments, /appointments/confirm altında aktif sayılmaz (Teyit ayrı sekme). */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/appointments") return false;
  return pathname.startsWith(`${href}/`);
}

type Props = {
  items: NavItem[];
  className?: string;
};

/** Dar ekranlar için üst çubuk menüsü — role göre filtrelenmiş sayfa listesi. */
export function MobileNavMenu({ items, className }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={className}
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-60 p-1.5">
        <nav aria-label="Menü" className="flex flex-col">
          {items.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-foreground"
                    : "text-foreground/80 hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </PopoverContent>
    </Popover>
  );
}
