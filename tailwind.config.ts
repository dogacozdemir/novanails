import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        nova: {
          cream: "var(--nova-cream)",
          charcoal: "var(--nova-charcoal)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        glass:
          "0 8px 32px rgb(26 26 26 / 6%), 0 2px 12px rgb(26 26 26 / 4%), inset 0 1px 0 rgb(255 255 255 / 55%)",
        "glass-lg":
          "0 24px 64px rgb(26 26 26 / 8%), 0 8px 24px rgb(26 26 26 / 5%), inset 0 1px 0 rgb(255 255 255 / 60%)",
        "glass-inner": "inset 0 1px 0 rgb(255 255 255 / 50%)",
        /** Liquid Glass v2 — çok düşük opaklıklı, geniş dağılan gölge */
        diffuse:
          "0 48px 120px -36px rgba(0,0,0,0.03), 0 28px 72px -28px rgba(0,0,0,0.03), 0 12px 36px -14px rgba(0,0,0,0.02)",
      },
      backdropBlur: {
        glass: "24px",
        "glass-strong": "40px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "18%": { transform: "translateX(-8px)" },
          "36%": { transform: "translateX(8px)" },
          "54%": { transform: "translateX(-6px)" },
          "72%": { transform: "translateX(6px)" },
          "90%": { transform: "translateX(-3px)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        /** Opacity + transform — composited (GPU), filter/stroke-dash yok */
        "nova-pulse": {
          "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.045)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 8s ease-in-out infinite",
        shake: "shake 0.48s cubic-bezier(0.36, 0.07, 0.19, 0.97) both",
        "spin-slow": "spin-slow 2.8s linear infinite",
        "nova-pulse": "nova-pulse 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
