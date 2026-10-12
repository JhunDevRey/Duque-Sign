"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label={t("nav.mainNavigation")} className="flex flex-col gap-1">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm",
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
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="font-semibold">{APP_NAME}</Link>
        <div className="flex items-center gap-2">
          <AuthControls fallbackName={userName} compact />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            className="rounded-md border border-border px-3 py-1 text-sm"
          >
            ☰
          </button>
        </div>
      </div>
      {open && <div className="border-b border-border bg-surface p-3 lg:hidden">{nav}</div>}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface p-4 lg:flex">
        <Link href="/dashboard" className="mb-1 px-3 text-lg font-semibold">
          {APP_NAME}
        </Link>
        <OrganizationLabel fallback={organization} />
        {nav}
        <AuthControls fallbackName={userName} />
      </aside>
    </>
  );
}
