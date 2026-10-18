import type { Metadata, Viewport } from "next";
import { Caveat, Roboto_Flex, Roboto_Mono } from "next/font/google";
import { LocalWorkspaceProvider } from "@/components/local-workspace";
import "./globals.css";

// Roboto Flex is Material 3's default typeface.
const robotoFlex = Roboto_Flex({
  variable: "--font-roboto-flex",
  subsets: ["latin", "latin-ext"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

// Typed signatures are drawn in a handwriting face.
const signature = Caveat({
  variable: "--font-signature",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Duque Sign",
  description: "Multi-tenant document signing and workflow platform.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6fafe" },
    { media: "(prefers-color-scheme: dark)", color: "#101417" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${robotoFlex.variable} ${robotoMono.variable} ${signature.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <LocalWorkspaceProvider>{children}</LocalWorkspaceProvider>
      </body>
    </html>
  );
}
