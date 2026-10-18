import { AppShell } from "@/components/app-shell";
import { NotConnectedButton } from "@/components/preview";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { sampleTemplates } from "@/lib/preview/sample-data";

export default function TemplatesPage() {
  return (
    <AppShell>
      <PageHeader
        title={t("templates.title")}
        subtitle={t("templates.subtitle")}
        actions={<NotConnectedButton variant="primary">{t("templates.newTemplate")}</NotConnectedButton>}
      />
      <Notice tone="warning" className="mb-5" title="Example templates">
        These templates are sample data. Template creation and document field placement are not available yet.
      </Notice>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {sampleTemplates.map((template) => (
          <Card key={template.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-title-large">{template.name}</h2>
                <p className="mt-1 text-body-small text-on-surface-variant">{formatDateTime(template.updatedAt)}</p>
              </div>
              <span className="inline-flex h-6 shrink-0 items-center rounded-sm bg-surface-container-highest px-2 text-label-medium text-on-surface-variant">{template.fieldCount} {t("templates.fields")}</span>
            </div>

            <div className="mt-4 space-y-3 text-body-medium">
              <div>
                <p className="font-medium">{t("templates.roles")}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {template.roles.map((role) => (
                    <span key={role} className="inline-flex h-8 items-center rounded-sm border border-outline-variant px-3 text-label-large text-on-surface-variant">{role}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium">{t("templates.variables")}</p>
                <p className="mt-1 text-on-surface-variant">{template.variables.join(", ") || "—"}</p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <NotConnectedButton variant="primary" size="sm">{t("templates.useTemplate")}</NotConnectedButton>
              <NotConnectedButton variant="secondary" size="sm">{t("templates.duplicate")}</NotConnectedButton>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
