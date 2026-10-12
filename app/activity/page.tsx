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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t("activity.columnTime")}</th>
                <th className="px-4 py-3 font-medium">{t("activity.columnActor")}</th>
                <th className="px-4 py-3 font-medium">{t("activity.columnAction")}</th>
                <th className="px-4 py-3 font-medium">{t("activity.columnDocument")}</th>
                <th className="px-4 py-3 font-medium">{t("activity.columnIp")}</th>
              </tr>
            </thead>
            <tbody>
              {sampleAuditEvents.map((event) => (
                <tr key={event.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{formatDateTime(event.at)}</td>
                  <td className="px-4 py-3">{event.actorLabel}</td>
                  <td className="px-4 py-3">{t(asMessageKey(`auditActions.${event.action}`))}</td>
                  <td className="px-4 py-3">{event.documentTitle || "—"}</td>
                  <td className="px-4 py-3 text-muted">{event.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
