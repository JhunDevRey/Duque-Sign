import type { Metadata, Viewport } from "next";
import { Caveat, Google_Sans, Google_Sans_Code } from "next/font/google";
import { LocalWorkspaceProvider } from "@/components/local-workspace";
import "./globals.css";

const googleSans = Google_Sans({
  variable: "--font-google-sans",
  subsets: ["latin"],
});

const googleSansCode = Google_Sans_Code({
  variable: "--font-google-sans-code",
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
    { media: "(prefers-color-scheme: light)", color: "#f8fafd" },
    { media: "(prefers-color-scheme: dark)", color: "#131314" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${googleSans.variable} ${googleSansCode.variable} ${signature.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <LocalWorkspaceProvider>{children}</LocalWorkspaceProvider>
      </body>
    </html>
  );
}
