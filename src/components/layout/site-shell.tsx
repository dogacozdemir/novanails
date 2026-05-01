import type { ReactNode } from "react";

import { ShellChrome } from "@/components/layout/shell-chrome";
import { getSessionProfile } from "@/lib/auth/session-profile";

type SiteShellProps = {
  children: ReactNode;
};

/** Sunucu: oturum rolü navigasyon için ShellChrome’a iletilir. */
export async function SiteShell({ children }: SiteShellProps) {
  const profile = await getSessionProfile();
  const navRole = profile?.role ?? null;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 ambient-nova grain-soft dark:ambient-nova-dark"
      />
      <ShellChrome navRole={navRole}>{children}</ShellChrome>
    </div>
  );
}
