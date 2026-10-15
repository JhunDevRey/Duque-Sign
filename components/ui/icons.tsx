import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Outlined 24px icons, drawn with the current text color. Decorative unless given a label. */
const paths = {
  dashboard: ["M4 4h6v7H4z", "M14 4h6v4h-6z", "M14 12h6v8h-6z", "M4 15h6v5H4z"],
  document: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5", "M9 13h6", "M9 17h4"],
  templates: ["m12 3-9 5 9 5 9-5z", "m3 13 9 5 9-5", "m3 17.5 9 4.5 9-4.5"],
  activity: ["M3 12h4l3-8 4 16 3-8h4"],
  settings: ["M4 6h9", "M19 6h1", "M4 12h3", "M13 12h7", "M4 18h11", "M21 18h-1", "M16 4v4", "M10 10v4", "M18 16v4"],
  plus: ["M12 5v14", "M5 12h14"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  logout: ["M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3", "m10 17-5-5 5-5", "M5 12h11"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "m20 20-4-4"],
  back: ["M19 12H5", "m12 19-7-7 7-7"],
  send: ["M21 3 10 14", "m21 3-6.5 18-4.5-7-7-4.5z"],
  link: ["M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1", "M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"],
  check: ["m5 12.5 4.5 4.5L19 7.5"],
  download: ["M12 4v11", "m7 11 5 5 5-5", "M5 20h14"],
  upload: ["M12 16V5", "m7 9 5-5 5 5", "M5 20h14"],
  pen: ["M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z", "m13.5 6.5 4 4"],
  edit: ["M4 20h16", "M14.5 4.5a2.1 2.1 0 0 1 3 3L9 16l-4 1 1-4z"],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"],
  alert: ["M12 3 2 20h20z", "M12 10v4", "M12 17h.01"],
  info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 11v5", "M12 8h.01"],
  user: ["M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M4 21a8 8 0 0 1 16 0"],
  trash: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12", "M9 7V4h6v3"],
  copy: ["M9 9h10v12H9z", "M5 15H4V3h11v1"],
  chevronRight: ["m9 6 6 6-6 6"],
  chevronLeft: ["m15 6-6 6 6 6"],
  ban: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "m5.6 5.6 12.8 12.8"],
  key: ["M8 11a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "m11 13 9-9", "m17 7 3 3", "m14 10 2 2"],
  webhook: ["M18 16.5a3 3 0 1 0-2.8-4", "M6 16.5a3 3 0 1 0 2.8 4", "M12 6a3 3 0 1 0-2.6 4.5L6 16.5", "M15.2 12.5 12 7", "M8.8 20.5H18"],
  shield: ["M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z", "m9 12 2 2 4-4"],
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  className,
  label,
  ...props
}: { name: IconName; label?: string } & Omit<ComponentProps<"svg">, "children">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn("size-5 shrink-0", className)}
      {...props}
    >
      {paths[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** The gradient sparkle brand mark. */
export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("brand-mark size-6", className)} />;
}
