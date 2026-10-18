import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "./badge";
import { Icon, type IconName } from "./icons";

const tones: Record<Tone, { box: string; name: IconName }> = {
  neutral: { box: "bg-surface-container-high text-on-surface", name: "info" },
  accent: { box: "bg-primary-container text-on-primary-container", name: "info" },
  success: { box: "bg-success-container text-on-success-container", name: "check" },
  warning: { box: "bg-warning-container text-on-warning-container", name: "alert" },
  danger: { box: "bg-error-container text-on-error-container", name: "alert" },
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
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-md px-4 py-3 text-body-medium", style.box, className)}>
      <Icon name={style.name} className="mt-px size-5" />
      <div className="min-w-0 flex-1">
        {title && <p className="text-title-small">{title}</p>}
        <div className={title ? "mt-0.5 opacity-90" : undefined}>{children}</div>
      </div>
    </div>
  );
}
