import type { ReactNode } from "react";
import { SupabaseAuthGuard } from "@/components/supabase-auth-guard";
import { PreviewBanner } from "@/components/preview";
import { Sidebar } from "@/components/shell/sidebar";
import { sampleViewer } from "@/lib/preview/sample-data";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <SupabaseAuthGuard>
        <div className="flex min-h-dvh w-full flex-col md:flex-row">
          <Sidebar userName={sampleViewer.name} organization={sampleViewer.organization} />
          <div className="flex min-w-0 flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
            <PreviewBanner />
            <main className="animate-rise mx-auto w-full max-w-6xl flex-1 px-4 pt-2 pb-10 sm:px-6 sm:pt-6 lg:px-10 lg:pt-8">
              {children}
            </main>
          </div>
        </div>
      </SupabaseAuthGuard>
    </div>
  );
}
