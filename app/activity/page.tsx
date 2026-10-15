import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import { sampleAuditEvents } from "@/lib/preview/sample-data";

const asMessageKey = (value: string) => value as MessageKey;

export default function ActivityPage() {
  return (
    <AppShell>
      <PageHeader title={t("activity.title")} subtitle={t("activity.subtitle")} />
      <Notice tone="warning" className="mb-5" title="Example activity">
        These audit entries are sample data and are not records of real document activity.
      </Notice>

      <div className="space-y-3 md:hidden">
        {sampleAuditEvents.map((event) => (
          <Card key={event.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words font-medium">{t(asMessageKey(`auditActions.${event.action}`))}</p>
              <time dateTime={event.at} className="shrink-0 text-right text-xs text-muted">{formatDateTime(event.at)}</time>
            </div>
            <dl className="mt-3 grid gap-3 border-t border-border/60 pt-3 text-sm">
              <div>
                <dt className="text-xs text-muted">{t("activity.columnActor")}</dt>
                <dd className="mt-0.5 break-words">{event.actorLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("activity.columnDocument")}</dt>
                <dd className="mt-0.5 break-words">{event.documentTitle || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("activity.columnIp")}</dt>
                <dd className="mt-0.5 break-all text-muted">{event.ip || "—"}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border/70 text-xs text-muted">
              <tr>
                <th className="px-6 py-3 font-medium">{t("activity.columnTime")}</th>
                <th className="px-6 py-3 font-medium">{t("activity.columnActor")}</th>
                <th className="px-6 py-3 font-medium">{t("activity.columnAction")}</th>
                <th className="px-6 py-3 font-medium">{t("activity.columnDocument")}</th>
                <th className="px-6 py-3 font-medium">{t("activity.columnIp")}</th>
              </tr>
            </thead>
            <tbody>
              {sampleAuditEvents.map((event) => (
                <tr key={event.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-6 py-3.5">{formatDateTime(event.at)}</td>
                  <td className="px-6 py-3.5">{event.actorLabel}</td>
                  <td className="px-6 py-3.5">{t(asMessageKey(`auditActions.${event.action}`))}</td>
                  <td className="px-6 py-3.5">{event.documentTitle || "—"}</td>
                  <td className="px-6 py-3.5 text-muted">{event.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
