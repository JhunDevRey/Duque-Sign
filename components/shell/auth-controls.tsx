"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient, isSupabaseClientConfigured } from "@/lib/supabase/client";

export function AuthControls({ fallbackName, compact = false }: { fallbackName: string; compact?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseClientConfigured) return;
    let active = true;
    void createSupabaseBrowserClient().auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError) {
        setError(authError.message);
        return;
      }
      setEmail(data.user?.email ?? null);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load your account.");
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    setError(null);
    try {
      const { error: signOutError } = await createSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    }
  }

  if (compact) {
    return (
      <div className="flex flex-col items-end">
        {isSupabaseClientConfigured ? (
          <button type="button" onClick={handleSignOut} className="min-h-11 rounded-md px-3 text-xs text-muted hover:bg-surface-muted hover:text-foreground">
            Sign out
          </button>
        ) : (
          <span className="px-2 text-xs text-muted">Auth unavailable</span>
        )}
        {error && <p role="alert" className="absolute top-full right-2 z-40 mt-1 max-w-[calc(100vw-1rem)] rounded-md border border-danger/30 bg-danger-soft p-2 text-xs text-danger shadow-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-auto border-t border-border px-3 pt-4 text-sm">
      <p className="truncate font-medium">{email ?? (isSupabaseClientConfigured ? "Signed-in user" : fallbackName)}</p>
      {isSupabaseClientConfigured ? (
        <button type="button" onClick={handleSignOut} className="text-xs text-muted hover:text-foreground">
          Sign out
        </button>
      ) : (
        <p className="text-xs text-muted">Supabase is not configured</p>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function OrganizationLabel({ fallback }: { fallback: string }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseClientConfigured) return;
    let active = true;
    void fetch("/api/organizations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load organization.");
        const result: unknown = await response.json();
        if (
          active &&
          typeof result === "object" &&
          result !== null &&
          "organizations" in result &&
          Array.isArray(result.organizations)
        ) {
          const first = result.organizations[0];
          if (typeof first === "object" && first !== null && "name" in first && typeof first.name === "string") {
            setName(first.name);
          }
        }
      })
      .catch((cause: unknown) => {
        if (active) setName(cause instanceof Error ? cause.message : "Unable to load organization.");
      });
    return () => {
      active = false;
    };
  }, []);

  return <p className="mb-6 truncate px-3 text-xs text-muted">{name ?? fallback}</p>;
}
