import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isProtectedAppRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/finance") ||
    pathname.startsWith("/appointments") ||
    pathname.startsWith("/services") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/staff")
  );
}

function isPublicRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/offline") ||
    pathname === "/manifest.webmanifest"
  );
}

function safeRedirectPath(nextParam: string | null): string {
  if (!nextParam || !nextParam.startsWith("/") || nextParam.startsWith("//")) {
    return "/dashboard";
  }
  if (nextParam === "/") return "/dashboard";
  return nextParam;
}

/**
 * Oturum çerezlerini yeniler; panel rotalarını oturum gerektirir.
 * getSession: hızlı JWT okuma (middleware TTFB).
 * Sunucu bileşenleri / kritik işlemler: `getSessionProfile()` içinde getUser().
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const pathname = request.nextUrl.pathname;

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.search = "";
    if (!user) {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role as "admin" | "staff" | undefined;
    if (role === "staff") {
      const blockedStaff =
        pathname.startsWith("/finance") ||
        pathname.startsWith("/settings") ||
        pathname.startsWith("/services") ||
        pathname.startsWith("/staff");
      if (blockedStaff) {
        const url = request.nextUrl.clone();
        url.pathname = "/appointments";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  if (!user && !isPublicRoute(pathname) && isProtectedAppRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/login")) {
    const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next, request.url));
  }

  return supabaseResponse;
}

/** Yalnızca uygulama rotaları — statik dosya / asset istekleri middleware’i çalıştırmaz */
export const config = {
  matcher: [
    "/",
    "/login",
    "/offline",
    "/dashboard/:path*",
    "/finance/:path*",
    "/appointments/:path*",
    "/services/:path*",
    "/customers/:path*",
    "/settings/:path*",
    "/staff/:path*",
  ],
};
