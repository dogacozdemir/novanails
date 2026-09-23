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
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden dark:hidden"
      >
        <div className="ambient-nova grain-soft absolute inset-0" />
        <div className="nova-aura-orb nova-aura-orb-tl" />
        <div className="nova-aura-orb nova-aura-orb-br" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 hidden ambient-nova-dark grain-soft dark:block"
      />
      <ShellChrome navRole={navRole}>{children}</ShellChrome>
    </div>
  );
}
