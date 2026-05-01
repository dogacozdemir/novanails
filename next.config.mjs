import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  productionBrowserSourceMaps: false,
  experimental: {
    /** PPR: Next stabil sürümünde kapalı; canary’de `experimental.ppr` denenebilir */
    optimizePackageImports: [
      "framer-motion",
      "recharts",
      "@radix-ui/react-dialog",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-popover",
    ],
  },
  async headers() {
    return [
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  cacheOnFrontEndNav: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

export default withPWA(nextConfig);
