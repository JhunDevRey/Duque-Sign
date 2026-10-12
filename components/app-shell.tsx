import type { ReactNode } from "react";
import { SupabaseAuthGuard } from "@/components/supabase-auth-guard";
import { PreviewBanner } from "@/components/preview";
import { Sidebar } from "@/components/shell/sidebar";
import { sampleViewer } from "@/lib/preview/sample-data";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <PreviewBanner />
      <SupabaseAuthGuard>
        <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col lg:flex-row">
          <Sidebar userName={sampleViewer.name} organization={sampleViewer.organization} />
          <main className="w-full min-w-0 flex-1 px-4 py-5 sm:p-6 lg:p-8">{children}</main>
        </div>
      </SupabaseAuthGuard>
    </div>
  );
}
