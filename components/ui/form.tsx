import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

// MD3 outlined text field: 1dp outline, on-surface outline on hover, 2dp primary outline on focus.
const control =
  "w-full rounded-xs border border-outline bg-transparent px-4 text-body-large text-on-surface transition-[border-color,box-shadow] duration-150 ease-standard placeholder:text-on-surface-variant hover:border-on-surface focus:border-primary focus:shadow-[inset_0_0_0_1px_var(--md-sys-color-primary)] focus:outline-none aria-invalid:border-error disabled:border-on-surface/12 disabled:opacity-38";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-14", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "select-chevron h-14", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-4", className)} {...props} />;
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-body-medium text-on-surface-variant">
        {label}
      </label>
      {children}
      {hint && <p className="px-4 text-body-small text-on-surface-variant">{hint}</p>}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-body-medium", className)}>
      <input type="checkbox" className="mt-px size-[18px] shrink-0 cursor-pointer rounded-xs accent-primary" {...props} />
      <span>{label}</span>
    </label>
  );
}
