import { AppShell } from "@/components/app-shell";
import { ApiKeysCard } from "@/components/settings/api-keys-card";
import { NotConnectedButton } from "@/components/preview";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { sampleMembers, sampleWebhookDeliveries, sampleWebhookEndpoints } from "@/lib/preview/sample-data";

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader title={t("settings.title")} subtitle="Organization settings and integrations" />
      <Notice tone="warning" className="mb-6" title="Partly sample data">
        API keys are live. The organization, member, and webhook values are still sample data; changing them is not available yet.
      </Notice>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <div className="mb-4 text-title-medium">{t("settings.tabOrganization")}</div>
          <div className="space-y-3 text-body-medium text-on-surface-variant">
            <div className="flex justify-between"><span>{t("settings.orgName")}</span><span className="font-medium text-on-surface">Sample Organization</span></div>
            <div className="flex justify-between"><span>{t("settings.defaultExpiry")}</span><span className="font-medium text-on-surface">30 days</span></div>
            <div className="flex justify-between"><span>{t("settings.senderName")}</span><span className="font-medium text-on-surface">Duque Sign</span></div>
            <div className="flex justify-between"><span>{t("settings.replyTo")}</span><span className="font-medium text-on-surface">noreply@duquesign.example</span></div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-4 text-title-medium">{t("settings.tabMembers")}</div>
          <div className="space-y-3">
            {sampleMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-md bg-surface-container p-4">
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-body-medium text-on-surface-variant">{member.email}</p>
                </div>
                <div className="text-right text-body-small text-on-surface-variant">
                  <p>{member.role}</p>
                  <p>{formatDateTime(member.joinedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <ApiKeysCard />

        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between text-title-medium">
            <span>{t("settings.tabWebhooks")}</span>
            <NotConnectedButton variant="secondary" size="sm">{t("settings.addEndpoint")}</NotConnectedButton>
          </div>
          <div className="space-y-3">
            {sampleWebhookEndpoints.map((endpoint) => (
              <div key={endpoint.id} className="rounded-md bg-surface-container p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium break-all">{endpoint.url}</p>
                  <span className="inline-flex h-6 items-center rounded-sm bg-success-container px-2 text-label-medium text-on-success-container">{endpoint.enabled ? t("settings.enabled") : t("settings.disabled")}</span>
                </div>
                <p className="mt-2 text-body-medium text-on-surface-variant">{endpoint.events.join(", ")}</p>
              </div>
            ))}
            <div className="rounded-md bg-surface-container-high p-4">
              <p className="text-title-small">{t("settings.recentDeliveries")}</p>
              <div className="mt-3 space-y-2">
                {sampleWebhookDeliveries.map((delivery) => (
                  <div key={delivery.id} className="flex items-center justify-between text-body-small text-on-surface-variant">
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
