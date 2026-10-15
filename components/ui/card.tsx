import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-3xl border border-border/70 bg-surface", className)}>{children}</section>;
}

export function CardHeader({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-5 pt-5 pb-3 sm:px-6", className)}>
      <h2 className="text-base font-medium">{title}</h2>
      {action}
    </div>
  );
}
