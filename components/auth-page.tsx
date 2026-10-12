import type { ReactNode } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/config/app";
import { Card } from "@/components/ui/card";
import { PreviewBanner } from "@/components/preview";

export function AuthPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PreviewBanner />
      <header className="border-b border-border bg-surface px-4 py-4">
        <div className="mx-auto max-w-5xl">
          <Link href="/dashboard" className="text-lg font-semibold">{APP_NAME}</Link>
        </div>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-xl items-center px-4 py-8">
        <Card className="w-full p-5 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </Card>
      </main>
    </div>
  );
}
