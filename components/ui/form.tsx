import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-2xl border border-transparent bg-surface-muted px-4 text-sm text-foreground transition-[background-color,border-color,box-shadow] placeholder:text-muted hover:bg-surface-strong focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "select-chevron h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-3", className)} {...props} />;
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
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="block px-1 text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="px-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded accent-accent" {...props} />
      <span>{label}</span>
    </label>
  );
}
