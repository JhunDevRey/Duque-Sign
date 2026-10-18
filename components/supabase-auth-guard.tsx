"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Notice } from "@/components/ui/notice";
import { isSupabaseClientConfigured } from "@/lib/supabase/client";

type GuardState = "checking" | "ready" | "no-organization" | "error";

export function SupabaseAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>(() => isSupabaseClientConfigured ? "checking" : "error");

  useEffect(() => {
    if (!isSupabaseClientConfigured) return;
    let active = true;

    async function checkOrganization() {
      try {
        const response = await fetch("/api/organizations", { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("Unable to load organization membership.");
        const result: unknown = await response.json();
        const organizations =
          typeof result === "object" && result !== null && "organizations" in result && Array.isArray(result.organizations)
            ? result.organizations
            : [];
        if (!active) return;
        if (organizations.length === 0) {
          setState("no-organization");
          return;
        }
        if (pathname === "/onboarding") {
          router.replace("/dashboard");
          return;
        }
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    }

    void checkOrganization();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (state === "checking") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-body-medium text-on-surface-variant" role="status">
        <span className="size-12 animate-spin rounded-full border-4 border-secondary-container border-t-primary" aria-hidden="true" />
        Checking your session…
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Notice tone="danger" title="Unable to load your workspace">
          Check the Supabase URL, anon key, and organization policies, then reload this page.
        </Notice>
      </div>
    );
  }
  if (state === "no-organization" && pathname !== "/onboarding") {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Notice tone="warning" title="No organization assigned">
          This account does not belong to an organization yet. Create your organization workspace to continue.
          <Link href="/onboarding" className="mt-3 inline-flex text-title-small text-primary underline-offset-4 hover:underline">
            Set up organization
          </Link>
        </Notice>
      </div>
    );
  }
  return <>{children}</>;
}
