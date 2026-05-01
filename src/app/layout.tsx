import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Inter } from "next/font/google";

import { SiteShell } from "@/components/layout/site-shell";

import "./globals.css";
import { cn } from "@/lib/utils";

function supabaseOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: true,
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  adjustFontFallback: true,
  fallback: ["Georgia", "Times New Roman", "Times", "serif"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e9" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Nova Studio",
    template: "%s · Nova Studio",
  },
  description:
    "Nova Nail Studio — iç panel: randevu, müşteri ve finans.",
  applicationName: "Nova Studio",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Nova Studio",
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const sbOrigin = supabaseOrigin();

  return (
    <html
      lang="tr"
      data-scroll-behavior="smooth"
      className={cn(inter.variable, cormorant.variable)}
    >
      <head>
        {sbOrigin ? (
          <>
            <link rel="preconnect" href={sbOrigin} crossOrigin="" />
            <link rel="dns-prefetch" href={sbOrigin} />
          </>
        ) : null}
        <link rel="apple-touch-startup-image" href="/splash/apple-splash.png" />
      </head>
      <body className="font-sans">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
