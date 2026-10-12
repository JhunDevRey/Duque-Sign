"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/config/app";
import { t, type MessageKey } from "@/lib/i18n";
import { AuthControls, OrganizationLabel } from "@/components/shell/auth-controls";

const links: Array<{ href: string; label: MessageKey }> = [
  { href: "/dashboard", label: "nav.dashboard" },
  { href: "/documents", label: "nav.documents" },
  { href: "/templates", label: "nav.templates" },
  { href: "/activity", label: "nav.activity" },
  { href: "/settings", label: "nav.settings" },
];

export function Sidebar({ userName, organization }: { userName: string; organization: string }) {
  const pathname = usePathname();
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const open = openForPath === pathname;

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenForPath(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const nav = (id: string) => (
    <nav id={id} aria-label={t("nav.mainNavigation")} className="flex flex-col gap-1">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpenForPath(null)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "min-h-11 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {t(link.label)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="min-w-0 truncate font-semibold">{APP_NAME}</Link>
        <div className="flex shrink-0 items-center gap-2">
          <AuthControls fallbackName={userName} compact />
          <button
            type="button"
            onClick={() => setOpenForPath(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="primary-navigation-mobile"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            className="inline-flex size-11 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span aria-hidden="true" className="text-xl leading-none">{open ? "×" : "☰"}</span>
          </button>
        </div>
      </header>
      {open && (
        <div className="w-full border-b border-border bg-surface p-3 shadow-sm lg:hidden">
          <OrganizationLabel fallback={organization} />
          {nav("primary-navigation-mobile")}
        </div>
      )}

      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface p-4 lg:flex">
        <Link href="/dashboard" className="mb-1 px-3 text-lg font-semibold">
          {APP_NAME}
        </Link>
        <OrganizationLabel fallback={organization} />
        {nav("primary-navigation-desktop")}
        <AuthControls fallbackName={userName} />
      </aside>
    </>
  );
}
