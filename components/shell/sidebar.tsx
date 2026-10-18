"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/config/app";
import { t, type MessageKey } from "@/lib/i18n";
import { AccountMenu, AuthControls, OrganizationLabel } from "@/components/shell/auth-controls";
import { BrandMark, Icon, type IconName } from "@/components/ui/icons";

const links: Array<{ href: string; label: MessageKey; icon: IconName }> = [
  { href: "/dashboard", label: "nav.dashboard", icon: "dashboard" },
  { href: "/documents", label: "nav.documents", icon: "document" },
  { href: "/templates", label: "nav.templates", icon: "templates" },
  { href: "/activity", label: "nav.activity", icon: "activity" },
  { href: "/settings", label: "nav.settings", icon: "settings" },
];

const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-secondary";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Adaptive MD3 navigation:
 * - compact (< 768px): top app bar, bottom navigation bar and a FAB
 * - medium (768–1023px): navigation rail with a FAB
 * - expanded (≥ 1024px): standard navigation drawer with an extended FAB
 */
export function Sidebar({ userName, organization }: { userName: string; organization: string }) {
  const pathname = usePathname();
  const onNewDocument = pathname === "/documents/new";

  return (
    <>
      {/* Compact: top app bar */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center gap-3 bg-surface pr-2 pl-4 md:hidden">
        <Link href="/dashboard" className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-full", focusRing)}>
          <BrandMark className="size-8" />
          <span className="truncate text-title-large">{APP_NAME}</span>
        </Link>
        <AccountMenu fallbackName={userName} organization={organization} placement="below" />
      </header>

      {/* Compact: navigation bar */}
      <nav
        aria-label={t("nav.mainNavigation")}
        className="fixed inset-x-0 bottom-0 z-30 flex bg-surface-container pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn("group flex h-20 min-w-0 flex-1 flex-col items-center justify-center gap-1", focusRing)}
            >
              <span
                className={cn(
                  "state-layer flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-200",
                  active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
                )}
              >
                <Icon name={link.icon} className="size-6" />
              </span>
              <span className={cn("max-w-full truncate px-1 text-label-medium", active ? "text-on-surface" : "text-on-surface-variant")}>
                {t(link.label)}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Compact: FAB above the navigation bar */}
      {!onNewDocument && (
        <Link
          href="/documents/new"
          aria-label={t("nav.newDocument")}
          title={t("nav.newDocument")}
          className={cn(
            "state-layer fixed right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-30 inline-flex size-14 items-center justify-center rounded-lg bg-primary-container text-on-primary-container shadow-elevation-3 md:hidden",
            focusRing,
          )}
        >
          <Icon name="plus" className="size-6" />
        </Link>
      )}

      {/* Medium: navigation rail */}
      <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center gap-1 bg-surface py-4 md:flex lg:hidden">
        <Link href="/dashboard" aria-label={APP_NAME} className={cn("mb-4 rounded-sm", focusRing)}>
          <BrandMark className="size-10" />
        </Link>
        <Link
          href="/documents/new"
          aria-label={t("nav.newDocument")}
          title={t("nav.newDocument")}
          className={cn(
            "state-layer mb-6 inline-flex size-14 items-center justify-center rounded-lg bg-primary-container text-on-primary-container",
            focusRing,
          )}
        >
          <Icon name="plus" className="size-6" />
        </Link>
        <nav aria-label={t("nav.mainNavigation")} className="flex flex-col gap-3">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex w-20 flex-col items-center gap-1 rounded-lg", focusRing)}
              >
                <span
                  className={cn(
                    "state-layer flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200",
                    active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
                  )}
                >
                  <Icon name={link.icon} className="size-6" />
                </span>
                <span className={cn("text-label-medium", active ? "text-on-surface" : "text-on-surface-variant")}>{t(link.label)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <AccountMenu fallbackName={userName} organization={organization} placement="side" />
        </div>
      </aside>

      {/* Expanded: standard navigation drawer */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col overflow-y-auto bg-surface-container-low px-3 py-4 lg:flex">
        <Link href="/dashboard" className={cn("flex min-w-0 items-center gap-3 rounded-lg px-4 py-2", focusRing)}>
          <BrandMark className="size-9" />
          <span className="min-w-0">
            <span className="block truncate text-title-large">{APP_NAME}</span>
            <OrganizationLabel fallback={organization} />
          </span>
        </Link>
        <Link
          href="/documents/new"
          className={cn(
            "state-layer mx-1 mt-4 mb-6 inline-flex h-14 w-fit items-center gap-3 rounded-lg bg-primary-container pr-5 pl-4 text-label-large text-on-primary-container shadow-elevation-1",
            focusRing,
          )}
        >
          <Icon name="plus" className="size-6" />
          {t("nav.newDocument")}
        </Link>
        <nav aria-label={t("nav.mainNavigation")} className="flex flex-col">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "state-layer flex h-14 items-center gap-3 rounded-full px-4 text-label-large transition-colors duration-200",
                  active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
                  focusRing,
                )}
              >
                <Icon name={link.icon} className="size-6" />
                {t(link.label)}
              </Link>
            );
          })}
        </nav>
        <AuthControls fallbackName={userName} />
      </aside>
    </>
  );
}
