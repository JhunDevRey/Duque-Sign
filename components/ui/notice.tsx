import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "./badge";

const tones: Record<Tone, string> = {
  neutral: "border-border bg-surface-muted text-foreground",
  accent: "border-accent/30 bg-accent-soft text-foreground",
  success: "border-success/30 bg-success-soft text-foreground",
  warning: "border-warning/30 bg-warning-soft text-foreground",
  danger: "border-danger/30 bg-danger-soft text-foreground",
};

export function Notice({
  tone = "neutral",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", tones[tone], className)}>
      {title && <p className="font-medium">{title}</p>}
      <div className={title ? "mt-0.5" : undefined}>{children}</div>
    </div>
  );
}
