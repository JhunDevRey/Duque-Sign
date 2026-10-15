import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "tonal" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,box-shadow,color,transform] duration-200 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:shadow-elevation-1 hover:brightness-110",
  tonal: "bg-accent-soft text-accent-soft-foreground hover:shadow-elevation-1",
  secondary: "border border-border bg-surface text-accent hover:bg-accent-soft/40",
  ghost: "text-accent hover:bg-accent-soft/50",
  danger: "border border-border bg-surface text-danger hover:border-danger/40 hover:bg-danger-soft",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/** A round, icon-only button. `label` is required for screen readers. */
export function IconButton({
  label,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}
