import { AppShell } from "@/components/app-shell";
import { NotConnectedButton } from "@/components/preview";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { sampleApiKeys, sampleMembers, sampleWebhookDeliveries, sampleWebhookEndpoints } from "@/lib/preview/sample-data";

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader title={t("settings.title")} subtitle="Organization settings and integrations" />
      <Notice tone="warning" className="mb-6" title="Example settings">
        These organization, member, API key, and webhook values are sample data. Settings changes and integration management are not available yet.
      </Notice>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <div className="mb-4 text-sm font-semibold">{t("settings.tabOrganization")}</div>
          <div className="space-y-3 text-sm text-muted">
            <div className="flex justify-between"><span>{t("settings.orgName")}</span><span className="font-medium text-foreground">Sample Organization</span></div>
            <div className="flex justify-between"><span>{t("settings.defaultExpiry")}</span><span className="font-medium text-foreground">30 days</span></div>
            <div className="flex justify-between"><span>{t("settings.senderName")}</span><span className="font-medium text-foreground">Duque Sign</span></div>
            <div className="flex justify-between"><span>{t("settings.replyTo")}</span><span className="font-medium text-foreground">noreply@duquesign.example</span></div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-4 text-sm font-semibold">{t("settings.tabMembers")}</div>
          <div className="space-y-3">
            {sampleMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted">{member.email}</p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>{member.role}</p>
                  <p>{formatDateTime(member.joinedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between text-sm font-semibold">
            <span>{t("settings.tabApiKeys")}</span>
            <NotConnectedButton variant="secondary" size="sm">{t("settings.createKey")}</NotConnectedButton>
          </div>
          <div className="space-y-3">
            {sampleApiKeys.map((key) => (
              <div key={key.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{key.name}</p>
                  <span className="rounded-full bg-surface-muted px-2 py-1 text-xs text-muted">{key.mode}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{key.displayPrefix}</p>
                <div className="mt-2 text-xs text-muted">{key.scopes.join(", ")}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between text-sm font-semibold">
            <span>{t("settings.tabWebhooks")}</span>
            <NotConnectedButton variant="secondary" size="sm">{t("settings.addEndpoint")}</NotConnectedButton>
          </div>
          <div className="space-y-3">
            {sampleWebhookEndpoints.map((endpoint) => (
              <div key={endpoint.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium break-all">{endpoint.url}</p>
                  <span className="rounded-full bg-success-soft px-2 py-1 text-xs text-success">{endpoint.enabled ? t("settings.enabled") : t("settings.disabled")}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{endpoint.events.join(", ")}</p>
              </div>
            ))}
            <div className="rounded-md border border-border bg-surface-muted p-3">
              <p className="text-sm font-medium">{t("settings.recentDeliveries")}</p>
              <div className="mt-3 space-y-2">
                {sampleWebhookDeliveries.map((delivery) => (
                  <div key={delivery.id} className="flex items-center justify-between text-xs text-muted">
                    <span>{delivery.event}</span>
                    <span>{delivery.outcome}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
