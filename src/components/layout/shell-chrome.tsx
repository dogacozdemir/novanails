"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { AppToaster } from "@/components/ui/app-toaster";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** null: oturum yok veya profil okunamadı — tam menü (köklü kısıtlama middleware’de). */
  navRole: UserRole | null;
};

/** Yalnızca pathname / chrome görünürlüğü için istemci sınırı — ana layout sunucuda kalır. */
export function ShellChrome({ children, navRole }: Props) {
  const pathname = usePathname();
  const hideChrome = pathname === "/login";

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      {!hideChrome ? <OfflineBanner /> : null}
      {!hideChrome ? <SiteHeader navRole={navRole} /> : null}
      <main
        className={cn(
          "flex-1",
          hideChrome && "flex min-h-0 flex-1 flex-col bg-[#F5F1E9]"
        )}
      >
        {children}
      </main>
      {!hideChrome ? <SiteFooter /> : null}
      {!hideChrome ? <MobileTabBar navRole={navRole} /> : null}
      <AppToaster />
    </div>
  );
}
