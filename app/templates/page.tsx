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
                <h2 className="text-lg font-semibold">{template.name}</h2>
                <p className="mt-1 text-xs text-muted">{formatDateTime(template.updatedAt)}</p>
              </div>
              <span className="rounded-full border border-border px-2 py-1 text-xs text-muted">{template.fieldCount} {t("templates.fields")}</span>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="font-medium">{t("templates.roles")}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {template.roles.map((role) => (
                    <span key={role} className="rounded-full bg-surface-muted px-2 py-1 text-xs text-muted">{role}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium">{t("templates.variables")}</p>
                <p className="mt-1 text-muted">{template.variables.join(", ") || "—"}</p>
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
