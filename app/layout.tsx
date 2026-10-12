import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LocalWorkspaceProvider } from "@/components/local-workspace";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Duque Sign",
  description: "Preview UI for a multi-tenant document signing and workflow platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocalWorkspaceProvider>{children}</LocalWorkspaceProvider>
      </body>
    </html>
  );
}
