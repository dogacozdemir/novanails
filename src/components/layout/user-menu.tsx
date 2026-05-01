"use client";

import LogOut from "lucide-react/dist/esm/icons/log-out.mjs";
import UserRound from "lucide-react/dist/esm/icons/user-round.mjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AUTH_STORAGE_MODE_KEY,
  createClient,
} from "@/lib/supabase/client";

import type { User } from "@supabase/supabase-js";

function displayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full =
    typeof meta?.full_name === "string"
      ? meta.full_name
      : typeof meta?.name === "string"
        ? meta.name
        : null;
  if (full?.trim()) return full.trim();
  const email = user.email ?? "";
  const local = email.split("@")[0];
  return local || "Hesap";
}

function clearSupabaseStorageKeys(storage: Storage) {
  try {
    Object.keys(storage).forEach((k) => {
      if (k.startsWith("sb-")) storage.removeItem(k);
    });
  } catch {
    /* ignore */
  }
}

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "global" });
      clearSupabaseStorageKeys(window.localStorage);
      clearSupabaseStorageKeys(window.sessionStorage);
      window.localStorage.removeItem(AUTH_STORAGE_MODE_KEY);
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  const label = displayName(user);
  const initial = label.slice(0, 2).toUpperCase();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex gap-2 rounded-xl border-[rgba(255,255,255,0.35)] bg-white/50 px-2 shadow-inner backdrop-blur-md sm:px-3 dark:bg-white/[0.08]",
            "transition-glass hover:bg-white/65 dark:hover:bg-white/[0.12]"
          )}
          aria-label="Profil menüsü"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 font-heading text-xs font-semibold text-primary ring-1 ring-primary/15 sm:size-8">
            {initial}
          </span>
          <span className="hidden max-w-[9rem] truncate text-left text-sm font-medium sm:inline">
            {label}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="glass-modal-surface w-56 border-[rgba(255,255,255,0.2)] p-2 backdrop-blur-xl"
      >
        <div className="flex items-start gap-3 border-b border-[var(--glass-border)] px-2 pb-3 pt-1">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
            <UserRound className="size-5 text-primary" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{label}</p>
            {user.email ? (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mt-1 w-full justify-start gap-2 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
          )}
          disabled={busy}
          onClick={() => void handleSignOut()}
        >
          <LogOut className="size-4" aria-hidden />
          Çıkış yap
        </button>
      </PopoverContent>
    </Popover>
  );
}
