import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = {
  title: "Giriş",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Suspense
        fallback={
          <div className="h-[28rem] w-full max-w-[420px] animate-pulse rounded-[1.75rem] border border-white/30 bg-white/30 backdrop-blur-xl" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
