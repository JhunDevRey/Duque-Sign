"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { useLocalWorkspace } from "@/components/local-workspace";
import { useAccountEmail } from "@/components/shell/auth-controls";
import { DocumentStatusBadge } from "@/components/status-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
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
  accent: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success",
  neutral: "bg-surface-strong text-foreground",
  warning: "bg-warning-soft text-warning",
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
        <h1 className="text-[34px] leading-tight tracking-tight sm:text-5xl">
          <span className="text-gradient">{name ? `Hello, ${name}` : "Hello"}</span>
        </h1>
        <p className="mt-2 text-lg text-muted sm:text-2xl">{t("dashboard.subtitle")}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href="/documents/new" variant="primary">
            <Icon name="upload" className="size-[18px]" />
            {t("nav.newDocument")}
          </ButtonLink>
          <ButtonLink href="/documents" variant="secondary">
            <Icon name="document" className="size-[18px]" />
            {t("dashboard.viewAll")}
          </ButtonLink>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.key} className="flex flex-col justify-between gap-6 rounded-3xl bg-surface-muted p-4 sm:p-5">
            <span className={cn("inline-flex size-10 items-center justify-center rounded-full", tileTones[metric.tone])}>
              <Icon name={metric.icon} />
            </span>
            <div>
              <p className="text-3xl leading-none tabular-nums sm:text-4xl">{ready ? metric.value : "—"}</p>
              <p className="mt-2 text-sm text-muted">{t(`dashboard.${metric.key}` as Parameters<typeof t>[0])}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="mt-8 overflow-hidden">
        <CardHeader
          title={t("dashboard.recentDocuments")}
          action={
            <Link href="/documents" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft/50">
              {t("dashboard.viewAll")}
              <Icon name="chevronRight" className="size-4" />
            </Link>
          }
        />
        {!ready ? (
          <div className="space-y-2 px-3 pb-4 sm:px-4">
            {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />)}
          </div>
        ) : recentDocuments.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-6 pb-10 text-center">
            <span className="brand-mark size-10" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted">{t("documents.empty")}</p>
            <ButtonLink href="/documents/new" variant="tonal" size="sm" className="mt-4">
              <Icon name="plus" className="size-4" />
              {t("nav.newDocument")}
            </ButtonLink>
          </div>
        ) : (
          <ul className="px-2 pb-2 sm:px-3 sm:pb-3">
            {recentDocuments.map((document) => (
              <li key={document.id}>
                <Link
                  href={`/documents/${document.id}`}
                  className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-surface-muted sm:gap-4"
                >
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                    <Icon name="document" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{document.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted sm:text-sm">
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
