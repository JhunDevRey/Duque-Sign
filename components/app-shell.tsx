import type { ReactNode } from "react";
import { FirebaseAuthGuard } from "@/components/firebase-auth-guard";
import { PreviewBanner } from "@/components/preview";
import { Sidebar } from "@/components/shell/sidebar";
import { sampleViewer } from "@/lib/preview/sample-data";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PreviewBanner />
      <FirebaseAuthGuard>
        <div className="mx-auto flex max-w-[1600px]">
          <Sidebar userName={sampleViewer.name} organization={sampleViewer.organization} />
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </FirebaseAuthGuard>
    </div>
  );
}
