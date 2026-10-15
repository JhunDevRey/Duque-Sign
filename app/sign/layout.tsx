import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Review and sign · Duque Sign",
  description: "Review and sign a document sent to you.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SignLayout({ children }: LayoutProps<"/sign">) {
  return children;
}
