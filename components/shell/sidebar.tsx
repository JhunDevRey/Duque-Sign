"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/config/app";
import { t, type MessageKey } from "@/lib/i18n";
import { AuthControls, OrganizationLabel } from "@/components/shell/auth-controls";
import { ButtonLink, IconButton } from "@/components/ui/button";
import { BrandMark, Icon, type IconName } from "@/components/ui/icons";

const links: Array<{ href: string; label: MessageKey; icon: IconName }> = [
  { href: "/dashboard", label: "nav.dashboard", icon: "dashboard" },
  { href: "/documents", label: "nav.documents", icon: "document" },
  { href: "/templates", label: "nav.templates", icon: "templates" },
  { href: "/activity", label: "nav.activity", icon: "activity" },
  { href: "/settings", label: "nav.settings", icon: "settings" },
];

function Brand({ organization }: { organization: string }) {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3 rounded-full px-2 py-1">
      <BrandMark className="size-7" />
      <span className="min-w-0">
        <span className="block truncate text-lg leading-tight">{APP_NAME}</span>
        <OrganizationLabel fallback={organization} />
      </span>
    </Link>
  );
}

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
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const content = (id: string) => (
    <>
      <ButtonLink
        href="/documents/new"
        variant="tonal"
        size="lg"
        onClick={() => setOpenForPath(null)}
        className="mt-6 mb-4 w-fit rounded-2xl pr-6 pl-5"
      >
        <Icon name="plus" />
        {t("nav.newDocument")}
      </ButtonLink>
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
                "flex min-h-12 items-center gap-3.5 rounded-full px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active
                  ? "bg-accent-soft font-medium text-accent-soft-foreground"
                  : "text-foreground/80 hover:bg-surface-strong hover:text-foreground",
              )}
            >
              <Icon name={link.icon} />
              {t(link.label)}
            </Link>
          );
        })}
      </nav>
      <AuthControls fallbackName={userName} />
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex w-full items-center gap-2 bg-background/85 px-2 py-2 backdrop-blur-md lg:hidden">
        <IconButton
          onClick={() => setOpenForPath(open ? null : pathname)}
          aria-expanded={open}
          aria-controls="primary-navigation-mobile"
          label={open ? "Close navigation menu" : "Open navigation menu"}
          className="text-foreground"
        >
          <Icon name="menu" />
        </IconButton>
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2">
          <BrandMark className="size-6" />
          <span className="truncate text-lg">{APP_NAME}</span>
        </Link>
        <ButtonLink href="/documents/new" variant="tonal" size="sm" className="size-11 px-0" aria-label={t("nav.newDocument")}>
          <Icon name="plus" />
        </ButtonLink>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setOpenForPath(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.mainNavigation")}
            className="animate-drawer absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col overflow-y-auto rounded-r-[28px] bg-surface-muted px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-elevation-2"
          >
            <div className="flex items-center justify-between gap-2">
              <Brand organization={organization} />
              <IconButton label="Close navigation menu" onClick={() => setOpenForPath(null)}>
                <Icon name="close" />
              </IconButton>
            </div>
            {content("primary-navigation-mobile")}
          </div>
        </div>
      )}

      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col overflow-y-auto bg-surface-muted px-3 py-5 lg:flex">
        <Brand organization={organization} />
        {content("primary-navigation-desktop")}
      </aside>
    </>
  );
}
