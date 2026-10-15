import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted",
  accent: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", tones[tone], className)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}
