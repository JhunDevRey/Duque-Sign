import { AppShell } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export default function NotFoundPage() {
  return (
    <AppShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span aria-hidden="true" className="inline-flex size-16 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
          <Icon name="document" className="size-8" />
        </span>
        <h1 className="mt-6 text-headline-large sm:text-display-small">{t("notFound.title")}</h1>
        <p className="mt-3 max-w-md text-body-large text-on-surface-variant">{t("notFound.body")}</p>
        <ButtonLink href="/dashboard" variant="primary" className="mt-6">
          <Icon name="dashboard" />
          {t("notFound.home")}
        </ButtonLink>
      </div>
    </AppShell>
  );
}
