"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { useLocalWorkspace } from "@/components/local-workspace";
import { useAccountEmail } from "@/components/shell/auth-controls";
import { DocumentStatusBadge } from "@/components/status-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { DocumentStatus } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

function firstName(email: string | null): string | null {
  if (!email) return null;
  const word = email.split("@")[0].split(/[._\-+0-9]+/).find(Boolean);
  return word ? word[0].toLocaleUpperCase() + word.slice(1) : null;
}

const tileTones = {
  accent: "bg-secondary-container text-on-secondary-container",
  success: "bg-success-container text-on-success-container",
  neutral: "bg-surface-container-highest text-on-surface-variant",
  warning: "bg-warning-container text-on-warning-container",
} as const;

export default function DashboardPage() {
  const { documents, ready } = useLocalWorkspace();
  const { email } = useAccountEmail();
  const name = firstName(email);
  const counts = useMemo(() => {
    const result: Record<DocumentStatus, number> = {
      draft: 0,
      sent: 0,
      in_progress: 0,
      completed: 0,
      declined: 0,
      cancelled: 0,
      expired: 0,
    };
    for (const document of documents) result[document.status] += 1;
    return result;
  }, [documents]);

  const metrics: Array<{ key: string; value: number; tone: keyof typeof tileTones; icon: IconName }> = [
    { key: "awaiting", value: counts.sent + counts.in_progress, tone: "accent", icon: "send" },
    { key: "completed", value: counts.completed, tone: "success", icon: "check" },
    { key: "drafts", value: counts.draft, tone: "neutral", icon: "edit" },
    { key: "needsAttention", value: counts.declined + counts.expired, tone: "warning", icon: "alert" },
  ];
  const recentDocuments = [...documents]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  return (
    <AppShell>
      <section className="mb-8 sm:mb-10">
        <h1 className="text-headline-large sm:text-display-small">{name ? `Hello, ${name}` : "Hello"}</h1>
        <p className="mt-2 text-body-large text-on-surface-variant sm:text-title-large sm:font-normal">{t("dashboard.subtitle")}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href="/documents/new" variant="primary">
            <Icon name="upload" />
            {t("nav.newDocument")}
          </ButtonLink>
          <ButtonLink href="/documents" variant="secondary">
            <Icon name="document" />
            {t("dashboard.viewAll")}
          </ButtonLink>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.key} className="flex flex-col justify-between gap-6 rounded-md bg-surface-container-highest p-4 sm:p-5">
            <span className={cn("inline-flex size-10 items-center justify-center rounded-full", tileTones[metric.tone])}>
              <Icon name={metric.icon} />
            </span>
            <div>
              <p className="text-headline-large tabular-nums sm:text-display-small">{ready ? metric.value : "—"}</p>
              <p className="mt-1 text-body-medium text-on-surface-variant">{t(`dashboard.${metric.key}` as Parameters<typeof t>[0])}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="mt-8 overflow-hidden">
        <CardHeader
          title={t("dashboard.recentDocuments")}
          action={
            <Link href="/documents" className={buttonClass("ghost", "sm")}>
              {t("dashboard.viewAll")}
              <Icon name="chevronRight" />
            </Link>
          }
        />
        {!ready ? (
          <div className="space-y-2 px-3 pb-4 sm:px-4">
            {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-surface-container-high" />)}
          </div>
        ) : recentDocuments.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-6 pb-10 text-center">
            <span aria-hidden="true" className="inline-flex size-12 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
              <Icon name="document" className="size-6" />
            </span>
            <p className="mt-4 text-body-medium text-on-surface-variant">{t("documents.empty")}</p>
            <ButtonLink href="/documents/new" variant="tonal" size="sm" className="mt-4">
              <Icon name="plus" />
              {t("nav.newDocument")}
            </ButtonLink>
          </div>
        ) : (
          <ul className="px-2 pb-2 sm:px-3 sm:pb-3">
            {recentDocuments.map((document) => (
              <li key={document.id}>
                <Link
                  href={`/documents/${document.id}`}
                  className="state-layer flex min-h-[72px] items-center gap-4 rounded-md px-3 py-2 sm:px-4"
                >
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                    <Icon name="document" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-large">{document.title}</p>
                    <p className="truncate text-body-medium text-on-surface-variant">
                      {document.recipients.map((recipient) => recipient.name).join(", ") || "—"} · {formatDateTime(document.updatedAt)}
                    </p>
                  </div>
                  <DocumentStatusBadge status={document.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
