import type { ReactNode } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/config/app";
import { PreviewBanner } from "@/components/preview";
import { BrandMark } from "@/components/ui/icons";

export function AuthPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="brand-glow flex min-h-dvh flex-col bg-background">
      <header className="px-4 pt-5 sm:px-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2.5 rounded-full py-1 pr-3">
          <BrandMark className="size-7" />
          <span className="text-xl">{APP_NAME}</span>
        </Link>
      </header>
      <PreviewBanner />
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="animate-rise w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-[32px] leading-tight tracking-tight sm:text-4xl">
              <span className="text-gradient">{title}</span>
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm text-muted sm:text-base">{subtitle}</p>
          </div>
          <div className="rounded-[28px] bg-surface p-6 shadow-elevation-1 sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
