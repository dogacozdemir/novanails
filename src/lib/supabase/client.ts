import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/** localStorage’ta tutulur; `session` = oturum (tarayıcı kapanınca), `local` = kalıcı (Beni hatırla). */
export const AUTH_STORAGE_MODE_KEY = "nova-auth-storage-mode";

export type AuthStorageMode = "local" | "session";

export function getAuthStorageMode(): AuthStorageMode {
  if (typeof window === "undefined") return "local";
  const raw = window.localStorage.getItem(AUTH_STORAGE_MODE_KEY);
  return raw === "session" ? "session" : "local";
}

export function getAuthStorage(): Storage {
  return getAuthStorageMode() === "session"
    ? window.sessionStorage
    : window.localStorage;
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storage:
        typeof window !== "undefined" ? getAuthStorage() : undefined,
    },
  });
}

/**
 * Giriş denemesi — checkbox’a göre token saklama yeri (local vs session).
 * Başarıdan sonra `AUTH_STORAGE_MODE_KEY` yazılmalıdır (createClient ile uyum için).
 */
export function createLoginSupabaseClient(rememberMe: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const storage = rememberMe ? window.localStorage : window.sessionStorage;

  return createBrowserClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storage,
    },
  });
}
