import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 sm:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-headline-medium sm:text-headline-large">{title}</h1>
        {subtitle && <p className="mt-1 break-words text-body-medium text-on-surface-variant sm:text-body-large">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">{actions}</div>}
    </div>
  );
}
