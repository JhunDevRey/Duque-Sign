import type { ReactNode } from "react";
import { SupabaseAuthGuard } from "@/components/supabase-auth-guard";
import { PreviewBanner } from "@/components/preview";
import { Sidebar } from "@/components/shell/sidebar";
import { sampleViewer } from "@/lib/preview/sample-data";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <SupabaseAuthGuard>
        <div className="flex min-h-dvh w-full flex-col lg:flex-row">
          <Sidebar userName={sampleViewer.name} organization={sampleViewer.organization} />
          <div className="flex min-w-0 flex-1 flex-col">
            <PreviewBanner />
            <main className="animate-rise mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-10 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">
              {children}
            </main>
          </div>
        </div>
      </SupabaseAuthGuard>
    </div>
  );
}
