import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "./badge";
import { Icon, type IconName } from "./icons";

const tones: Record<Tone, { box: string; icon: string; name: IconName }> = {
  neutral: { box: "bg-surface-muted", icon: "text-muted", name: "info" },
  accent: { box: "bg-accent-soft/70", icon: "text-accent", name: "info" },
  success: { box: "bg-success-soft", icon: "text-success", name: "check" },
  warning: { box: "bg-warning-soft", icon: "text-warning", name: "alert" },
  danger: { box: "bg-danger-soft", icon: "text-danger", name: "alert" },
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
  const style = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-2xl px-4 py-3 text-sm text-foreground", style.box, className)}>
      <Icon name={style.name} className={cn("mt-px size-[18px]", style.icon)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        <div className={title ? "mt-0.5 text-foreground/85" : undefined}>{children}</div>
      </div>
    </div>
  );
}
