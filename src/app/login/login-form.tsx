"use client";

import Eye from "lucide-react/dist/esm/icons/eye.mjs";
import EyeOff from "lucide-react/dist/esm/icons/eye-off.mjs";
import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AUTH_STORAGE_MODE_KEY,
  createLoginSupabaseClient,
} from "@/lib/supabase/client";

function safeInternalNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw === "/") return "/dashboard";
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeInternalNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  const triggerShake = () => {
    setShake(true);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => setShake(false), 520);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const supabase = createLoginSupabaseClient(rememberMe);
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr) {
        triggerShake();
        setError("Bilgiler kontrol ediniz.");
        return;
      }
      window.localStorage.setItem(
        AUTH_STORAGE_MODE_KEY,
        rememberMe ? "local" : "session"
      );
      router.push(nextPath);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full max-w-[420px] flex-col items-center px-4">
      <div
        className={cn(
          "w-full rounded-[1.75rem] border border-[rgba(255,255,255,0.35)] bg-white/[0.42] p-8 shadow-glass-lg backdrop-blur-xl dark:bg-[rgb(9_9_11_/0.55)] dark:backdrop-blur-xl",
          shake && "animate-shake"
        )}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex size-[4.5rem] items-center justify-center overflow-hidden rounded-2xl bg-[#F5F1E9]/90 shadow-inner ring-1 ring-black/[0.06] dark:bg-zinc-900/80 dark:ring-white/[0.08]">
            <Image
              src="/logo-mark.svg"
              alt="Nova Nail Studio"
              width={52}
              height={52}
              className="size-[3.25rem] object-contain"
              sizes="52px"
              priority
            />
          </div>
          <div className="space-y-1">
            <p className="font-heading text-2xl font-semibold tracking-tight text-[var(--nova-charcoal)] dark:text-foreground">
              Hoş Geldiniz
            </p>
            <p className="text-sm text-muted-foreground">
              Panele devam etmek için oturum açın.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="login-email"
              className="text-xs font-medium text-muted-foreground"
            >
              E-posta
            </label>
            <Input
              id="login-email"
              type="email"
              name="username"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="adres@ornek.com"
              disabled={busy}
              className="h-12 rounded-2xl border-white/40 bg-white/55 shadow-inner backdrop-blur-xl dark:bg-white/[0.08]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="login-password"
              className="text-xs font-medium text-muted-foreground"
            >
              Şifre
            </label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                className="h-12 rounded-2xl border-white/40 bg-white/55 pr-12 shadow-inner backdrop-blur-xl dark:bg-white/[0.08]"
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={busy}
              className="mt-0.5 size-4 shrink-0 rounded-md border border-[var(--glass-border)] bg-white/60 text-primary accent-[var(--nova-charcoal)] backdrop-blur-md dark:bg-white/10"
            />
            <span className="text-sm leading-snug text-foreground/90">
              Beni hatırla — oturumu bu tarayıcıda uzun süre açık tutar.
            </span>
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-2xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-center text-sm font-medium text-red-900/90 dark:text-red-100"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            className="h-12 w-full rounded-2xl bg-[var(--nova-charcoal)] text-[var(--nova-cream)] shadow-glass-inner hover:bg-[var(--nova-charcoal)]/92 dark:bg-primary dark:text-primary-foreground"
            disabled={busy || !email.trim() || !password}
            onClick={() => void submit()}
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              "Giriş yap"
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
