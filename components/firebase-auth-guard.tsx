"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isFirebaseClientConfigured } from "@/lib/firebase/client";
import { Notice } from "@/components/ui/notice";
import { refreshWorkspace } from "@/components/local-workspace";

export function FirebaseAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"checking" | "ready" | "error">(
    isFirebaseClientConfigured ? "checking" : "ready",
  );

  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    let active = true;

    async function verifySession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("Unable to verify your Firebase session.");
        const membershipResponse = await fetch("/api/organizations", { cache: "no-store" });
        if (!membershipResponse.ok) throw new Error("Unable to load your organization membership.");
        const result: unknown = await membershipResponse.json();
        if (
          typeof result === "object" &&
          result !== null &&
          "organizations" in result &&
          Array.isArray(result.organizations) &&
          result.organizations.length === 0 &&
          pathname !== "/onboarding"
        ) {
          router.replace("/onboarding");
          return;
        }
        await refreshWorkspace();
        if (active) setState("ready");
      } catch {
        if (active) setState("error");
      }
    }

    void verifySession();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (state === "checking") {
    return <div className="mx-auto flex min-h-[40vh] max-w-xl items-center justify-center text-sm text-muted">Checking your session…</div>;
  }
  if (state === "error") {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Notice tone="danger" title="Unable to verify Firebase session">
          Check the server Firebase environment settings, then reload this page.
        </Notice>
      </div>
    );
  }
  return children;
}
