import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * MD3 common buttons: primary = filled, tonal = filled tonal, secondary = outlined,
 * ghost = text, danger = outlined in the error color. Hover/press feedback is a state layer.
 */
type Variant = "primary" | "tonal" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "state-layer inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full transition-[box-shadow,background-color,color] duration-200 ease-standard focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:pointer-events-none disabled:opacity-38 [&_svg]:size-[18px]";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:shadow-elevation-1",
  tonal: "bg-secondary-container text-on-secondary-container hover:shadow-elevation-1",
  secondary: "border border-outline text-primary",
  ghost: "text-primary",
  danger: "border border-outline text-error",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-label-large",
  md: "h-10 px-6 text-label-large has-[svg]:pl-4",
  lg: "h-14 px-6 text-title-medium [&_svg]:size-6",
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

/** MD3 standard icon button (40dp, 48dp target). `label` is required for screen readers. */
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
        "state-layer inline-flex size-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:pointer-events-none disabled:opacity-38 [&_svg]:size-6",
        className,
      )}
      {...props}
    />
  );
}
