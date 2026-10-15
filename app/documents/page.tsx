"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useLocalWorkspace } from "@/components/local-workspace";
import { DocumentStatusBadge, RecipientStatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import type { DocumentStatus } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

const statuses: Array<DocumentStatus | "all"> = [
  "all",
  "draft",
  "sent",
  "in_progress",
  "completed",
  "declined",
  "cancelled",
  "expired",
];

const asMessageKey = (value: string) => value as MessageKey;

export default function DocumentsPage() {
  const { documents, ready, error } = useLocalWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DocumentStatus | "all">("all");

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return documents
      .filter((document) => {
        const matchesStatus = status === "all" || document.status === status;
        const matchesSearch =
          !normalizedSearch ||
          document.title.toLocaleLowerCase().includes(normalizedSearch) ||
          document.externalId?.toLocaleLowerCase().includes(normalizedSearch) ||
          document.recipients.some(
            (recipient) =>
              recipient.name.toLocaleLowerCase().includes(normalizedSearch) ||
              recipient.email.toLocaleLowerCase().includes(normalizedSearch),
          );
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [documents, search, status]);

  return (
    <AppShell>
      <PageHeader
        title={t("documents.title")}
        subtitle={t("documents.subtitle")}
        actions={
          <ButtonLink href="/documents/new" variant="primary">
            <Icon name="plus" className="size-[18px]" />
            {t("nav.newDocument")}
          </ButtonLink>
        }
      />

      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}

      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("documents.searchPlaceholder")}
          aria-label={t("documents.searchPlaceholder")}
          className="h-14 w-full rounded-full border border-transparent bg-surface-muted pr-5 pl-14 text-base text-foreground transition-[background-color,border-color,box-shadow] placeholder:text-muted hover:bg-surface-strong focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15"
        />
      </div>

      <div className="-mx-4 mt-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap" role="group" aria-label={t("common.status")}>
          {statuses.map((item) => {
            const label = item === "all" ? t("documents.filterAll") : t(asMessageKey(`documentStatus.${item}`));
            const active = status === item;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(item)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  active
                    ? "border-transparent bg-accent-soft text-accent-soft-foreground"
                    : "border-border text-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {active && <Icon name="check" className="size-4" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {!ready ? (
        <div className="mt-6 space-y-2">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-3xl bg-surface-muted" />)}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center px-6 py-14 text-center">
          <span className="brand-mark size-10" aria-hidden="true" />
          <p className="mt-4 font-medium">{t("documents.empty")}</p>
          {documents.length === 0 && (
            <ButtonLink href="/documents/new" variant="tonal" size="sm" className="mt-4">
              <Icon name="plus" className="size-4" />
              {t("nav.newDocument")}
            </ButtonLink>
          )}
        </Card>
      ) : (
        <Card className="mt-6 overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_10rem_8rem] gap-4 border-b border-border/70 px-6 py-3 text-xs font-medium text-muted xl:grid">
            <span>{t("documents.columnTitle")}</span>
            <span>{t("documents.columnRecipients")}</span>
            <span>{t("documents.columnUpdated")}</span>
            <span className="text-right">{t("common.status")}</span>
          </div>
          <ul className="p-2 xl:p-0">
            {filteredDocuments.map((document) => (
              <li key={document.id} className="xl:border-b xl:border-border/50 xl:last:border-0">
                <Link
                  href={`/documents/${document.id}`}
                  className="flex flex-col gap-3 rounded-2xl p-3 transition-colors hover:bg-surface-muted xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_10rem_8rem] xl:items-center xl:gap-4 xl:rounded-none xl:px-6 xl:py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                      <Icon name="document" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{document.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {document.externalId ? t("documents.reference", { ref: document.externalId }) : t("documents.version", { version: document.version })}
                      </p>
                    </div>
                    <span className="xl:hidden"><DocumentStatusBadge status={document.status} /></span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-13 xl:pl-0">
                    {document.recipients.map((recipient) => (
                      <span key={recipient.id} className="inline-flex max-w-full items-center gap-2 rounded-full bg-surface-muted py-0.5 pr-0.5 pl-3 text-xs">
                        <span className="truncate">{recipient.name}</span>
                        <RecipientStatusBadge status={recipient.status} />
                      </span>
                    ))}
                  </div>
                  <p className="pl-13 text-xs text-muted xl:pl-0 xl:text-sm">{formatDateTime(document.updatedAt)}</p>
                  <span className="hidden justify-self-end xl:block"><DocumentStatusBadge status={document.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}
