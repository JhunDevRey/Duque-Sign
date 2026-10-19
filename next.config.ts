import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js loads its worker module at runtime on the server (API anchor detection); keep it unbundled.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
