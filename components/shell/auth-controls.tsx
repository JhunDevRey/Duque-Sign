"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-title-medium text-on-primary-container",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** The account label and sign-out action shared by the drawer card and the account menu. */
function useAccount(fallbackName: string) {
  const router = useRouter();
  const { email, error: loadError } = useAccountEmail();
  const [error, setError] = useState<string | null>(null);
  const displayName = email ?? (isSupabaseClientConfigured ? "Signed-in user" : fallbackName);

  async function signOut() {
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

  return { displayName, signOut, message: error ?? loadError };
}

/** Account card at the foot of the navigation drawer. */
export function AuthControls({ fallbackName }: { fallbackName: string }) {
  const { displayName, signOut, message } = useAccount(fallbackName);
  return (
    <div className="mt-auto pt-4">
      <div className="flex items-center gap-3 rounded-lg bg-surface-container-highest py-2 pr-2 pl-3">
        <Avatar name={displayName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-title-small">{displayName}</p>
          {!isSupabaseClientConfigured && <p className="truncate text-body-small text-on-surface-variant">Supabase is not configured</p>}
        </div>
        {isSupabaseClientConfigured && (
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="state-layer inline-flex size-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant"
          >
            <Icon name="logout" className="size-6" />
          </button>
        )}
      </div>
      {message && <p role="alert" className="mt-2 px-3 text-body-small text-error">{message}</p>}
    </div>
  );
}

/** Avatar button that opens an MD3 menu with the account and sign-out (top app bar and rail). */
export function AccountMenu({ fallbackName, organization, placement }: { fallbackName: string; organization: string; placement: "below" | "side" }) {
  const { displayName, signOut, message } = useAccount(fallbackName);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        title={displayName}
        className="state-layer inline-flex size-12 items-center justify-center rounded-full"
      >
        <Avatar name={displayName} className="size-8 text-label-large" />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 w-64 rounded-xs bg-surface-container py-2 shadow-elevation-2",
            placement === "below" ? "top-full right-0 mt-1" : "bottom-0 left-full ml-2",
          )}
        >
          <div className="px-4 pt-1 pb-3">
            <p className="truncate text-title-small">{displayName}</p>
            <OrganizationLabel fallback={organization} />
          </div>
          <div className="my-1 h-px bg-outline-variant" />
          {isSupabaseClientConfigured ? (
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="state-layer flex h-12 w-full items-center gap-3 px-4 text-left text-label-large text-on-surface"
            >
              <Icon name="logout" className="size-6 text-on-surface-variant" />
              Sign out
            </button>
          ) : (
            <p className="px-4 py-3 text-body-small text-on-surface-variant">Supabase is not configured</p>
          )}
          {message && <p role="alert" className="px-4 pb-2 text-body-small text-error">{message}</p>}
        </div>
      )}
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

  return <p className="truncate text-body-small text-on-surface-variant">{name ?? fallback}</p>;
}
