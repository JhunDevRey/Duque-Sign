import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/i18n";

export default function NotFoundPage() {
  return (
    <AppShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-2xl font-semibold">{t("notFound.title")}</h1>
          <p className="mt-2 text-sm text-muted">{t("notFound.body")}</p>
          <Link href="/dashboard" className="mt-5 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            {t("notFound.home")}
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}
