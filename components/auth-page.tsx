import type { ReactNode } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/config/app";
import { PreviewBanner } from "@/components/preview";
import { BrandMark } from "@/components/ui/icons";

export function AuthPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-container-low">
      <header className="flex h-16 items-center px-4 sm:px-6">
        <Link href="/dashboard" className="inline-flex items-center gap-3 rounded-full py-1 pr-3">
          <BrandMark className="size-8" />
          <span className="text-title-large">{APP_NAME}</span>
        </Link>
      </header>
      <PreviewBanner />
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="animate-rise w-full max-w-md">
          <div className="rounded-2xl bg-surface p-6 sm:p-10">
            <div className="mb-8">
              <h1 className="text-headline-medium sm:text-headline-large">{title}</h1>
              <p className="mt-2 text-body-medium text-on-surface-variant sm:text-body-large">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
