"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useLocalWorkspace } from "@/components/local-workspace";
import { DocumentStatusBadge, RecipientStatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/form";
import { formatDateTime } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import type { DocumentStatus } from "@/lib/domain/types";

const statuses: Array<DocumentStatus | "all"> = [
  "all",
  "draft",
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
    return documents.filter((document) => {
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
    });
  }, [documents, search, status]);

  return (
    <AppShell>
      <PageHeader
        title={t("documents.title")}
        subtitle={t("documents.subtitle")}
        actions={<ButtonLink href="/documents/new" variant="primary">{t("nav.newDocument")}</ButtonLink>}
      />

      {error && <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{error}</p>}

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full max-w-md">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("documents.searchPlaceholder")}
              aria-label={t("documents.searchPlaceholder")}
            />
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted">
            {statuses.map((item) => {
              const label = item === "all" ? t("documents.filterAll") : t(asMessageKey(`documentStatus.${item}`));
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={status === item}
                  onClick={() => setStatus(item)}
                  className={`rounded-full border px-2.5 py-1 transition-colors ${
                    status === item ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-muted"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {!ready ? (
        <p className="mt-6 text-sm text-muted">{t("common.loading")}</p>
      ) : filteredDocuments.length === 0 ? (
        <Card className="mt-6 p-10 text-center">
          <p className="font-medium">{t("documents.empty")}</p>
          {documents.length === 0 && (
            <ButtonLink href="/documents/new" variant="primary" size="sm" className="mt-4">{t("nav.newDocument")}</ButtonLink>
          )}
        </Card>
      ) : (
        <Card className="mt-6 overflow-hidden">
          <div className="divide-y divide-border md:hidden">
            {filteredDocuments.map((document) => (
              <Link key={document.id} href={`/documents/${document.id}`} className="block space-y-3 p-4 hover:bg-surface-muted">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{document.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {document.externalId ? t("documents.reference", { ref: document.externalId }) : t("documents.version", { version: document.version })}
                    </p>
                  </div>
                  <DocumentStatusBadge status={document.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {document.recipients.map((recipient) => (
                    <span key={recipient.id} className="inline-flex flex-col gap-1 rounded-md border border-border px-2 py-1 text-xs">
                      <span>{recipient.name}</span>
                      <RecipientStatusBadge status={recipient.status} />
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted">{formatDateTime(document.updatedAt)}</p>
              </Link>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("documents.columnTitle")}</th>
                  <th className="px-4 py-3 font-medium">{t("documents.columnRecipients")}</th>
                  <th className="px-4 py-3 font-medium">{t("documents.columnUpdated")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((document) => (
                  <tr key={document.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-4 align-top">
                      <Link href={`/documents/${document.id}`} className="block">
                        <p className="font-medium text-foreground">{document.title}</p>
                        <p className="mt-1 text-xs text-muted">
                          {document.externalId ? t("documents.reference", { ref: document.externalId }) : t("documents.version", { version: document.version })}
                        </p>
                      </Link>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {document.recipients.map((recipient) => (
                          <span key={recipient.id} className="inline-flex flex-col gap-1 rounded-md border border-border px-2 py-1">
                            <span>{recipient.name}</span>
                            <RecipientStatusBadge status={recipient.status} />
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-muted">{formatDateTime(document.updatedAt)}</td>
                    <td className="px-4 py-4 align-top"><DocumentStatusBadge status={document.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
