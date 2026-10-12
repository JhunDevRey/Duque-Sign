"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { useLocalWorkspace } from "@/components/local-workspace";
import { DocumentStatusBadge, RecipientStatusBadge } from "@/components/status-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { DocumentStatus } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

export default function DashboardPage() {
  const { documents, ready } = useLocalWorkspace();
  const counts = useMemo(() => {
    const result: Record<DocumentStatus, number> = {
      draft: 0,
      in_progress: 0,
      completed: 0,
      declined: 0,
      cancelled: 0,
      expired: 0,
    };
    for (const document of documents) result[document.status] += 1;
    return result;
  }, [documents]);

  const metrics = [
    { key: "awaiting", value: counts.in_progress, tone: "accent" as const },
    { key: "completed", value: counts.completed, tone: "success" as const },
    { key: "drafts", value: counts.draft, tone: "neutral" as const },
    { key: "needsAttention", value: counts.declined + counts.expired, tone: "warning" as const },
  ];
  const recentDocuments = [...documents]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  return (
    <AppShell>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        actions={<ButtonLink href="/documents/new" variant="primary">{t("nav.newDocument")}</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.key} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted">{t(`dashboard.${metric.key}` as Parameters<typeof t>[0])}</p>
                <p className="mt-2 text-3xl font-semibold">{ready ? metric.value : "—"}</p>
              </div>
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
                  metric.tone === "accent" && "bg-accent-soft text-accent",
                  metric.tone === "success" && "bg-success-soft text-success",
                  metric.tone === "warning" && "bg-warning-soft text-warning",
                  metric.tone === "neutral" && "bg-surface-muted text-muted",
                )}
              >
                {ready ? metric.value : "—"}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader
            title={t("dashboard.recentDocuments")}
            action={<Link href="/documents" className="text-sm text-accent hover:underline">{t("dashboard.viewAll")}</Link>}
          />
          {recentDocuments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted">{t("documents.empty")}</p>
              <ButtonLink href="/documents/new" variant="primary" size="sm" className="mt-4">{t("nav.newDocument")}</ButtonLink>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentDocuments.map((document) => (
                <Link key={document.id} href={`/documents/${document.id}`} className="block p-4 transition-colors hover:bg-surface-muted">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{document.title}</p>
                      <p className="mt-1 text-sm text-muted">
                        {document.externalId ? `${t("documents.reference", { ref: document.externalId })} · ` : ""}
                        {t("documents.pages", { count: document.pageCount })} · {formatDateTime(document.updatedAt)}
                      </p>
                    </div>
                    <DocumentStatusBadge status={document.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {document.recipients.map((recipient) => (
                      <span key={recipient.id} className="inline-flex items-center gap-2 rounded-full border border-border px-2 py-1 text-xs">
                        {recipient.name}
                        <RecipientStatusBadge status={recipient.status} />
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
