import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** MD3 outlined card. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-md border border-outline-variant bg-surface", className)}>{children}</section>;
}

export function CardHeader({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-4 pt-4 pb-2 sm:px-6 sm:pt-5", className)}>
      <h2 className="text-title-medium">{title}</h2>
      {action}
    </div>
  );
}
