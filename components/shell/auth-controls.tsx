"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isFirebaseClientConfigured } from "@/lib/firebase/client";

export function AuthControls({ fallbackName, compact = false }: { fallbackName: string; compact?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const user: unknown = await response.json();
        if (active && typeof user === "object" && user !== null && "email" in user && typeof user.email === "string") {
          setEmail(user.email);
        }
      })
      .catch(() => {
        if (active) setEmail(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not end the server session. Try again.");
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    }
  }

  if (compact) {
    return isFirebaseClientConfigured ? (
      <button type="button" onClick={handleSignOut} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-muted hover:text-foreground">
        Sign out
      </button>
    ) : (
      <span className="text-xs text-muted">Local mode</span>
    );
  }

  return (
    <div className="mt-auto border-t border-border px-3 pt-4 text-sm">
      <p className="truncate font-medium">{email ?? (isFirebaseClientConfigured ? "Signed-in user" : fallbackName)}</p>
      {!isFirebaseClientConfigured ? (
        <p className="text-xs text-muted">Local browser workspace</p>
      ) : (
        <button type="button" onClick={handleSignOut} className="text-xs text-muted hover:text-foreground">
          Sign out
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function OrganizationLabel({ fallback }: { fallback: string }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    let active = true;
    void fetch("/api/organizations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
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
      .catch(() => {
        if (active) setName(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return <p className="mb-6 truncate px-3 text-xs text-muted">{isFirebaseClientConfigured ? name ?? "Organization" : fallback}</p>;
}
