"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient, isSupabaseClientConfigured } from "@/lib/supabase/client";

/** The signed-in user's email, or null while loading / when signed out. */
export function useAccountEmail() {
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

  return { email, error };
}

function initials(value: string): string {
  const name = value.split("@")[0].replace(/[._-]+/g, " ").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toLocaleUpperCase() || "?";
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white",
        className,
      )}
      style={{ background: "var(--brand-gradient)" }}
    >
      {initials(name)}
    </span>
  );
}

export function AuthControls({ fallbackName }: { fallbackName: string }) {
  const router = useRouter();
  const { email, error: loadError } = useAccountEmail();
  const [error, setError] = useState<string | null>(null);
  const displayName = email ?? (isSupabaseClientConfigured ? "Signed-in user" : fallbackName);

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

  const message = error ?? loadError;
  return (
    <div className="mt-auto pt-4">
      <div className="flex items-center gap-3 rounded-full bg-surface p-1.5 pr-1 shadow-elevation-1">
        <Avatar name={displayName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {!isSupabaseClientConfigured && <p className="truncate text-xs text-muted">Supabase is not configured</p>}
        </div>
        {isSupabaseClientConfigured && (
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <Icon name="logout" className="size-[18px]" />
          </button>
        )}
      </div>
      {message && <p role="alert" className="mt-2 px-3 text-xs text-danger">{message}</p>}
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

  return <p className="truncate text-xs text-muted">{name ?? fallback}</p>;
}
