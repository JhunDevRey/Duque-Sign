import { AppShell } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export default function NotFoundPage() {
  return (
    <AppShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="brand-mark size-12" aria-hidden="true" />
        <h1 className="mt-6 text-4xl tracking-tight sm:text-5xl">
          <span className="text-gradient">{t("notFound.title")}</span>
        </h1>
        <p className="mt-3 max-w-md text-muted">{t("notFound.body")}</p>
        <ButtonLink href="/dashboard" variant="primary" className="mt-6">
          <Icon name="dashboard" className="size-[18px]" />
          {t("notFound.home")}
        </ButtonLink>
      </div>
    </AppShell>
  );
}
