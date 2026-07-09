import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Node-only ingestion deps as require()-at-runtime instead of bundled.
  // jsdom + mammoth pull in mixed ESM/CJS chains (html-encoding-sniffer →
  // @exodus/bytes) that Turbopack fails to require() from a bundled context.
  // pdfjs-dist uses a worker load path that also breaks when bundled.
  serverExternalPackages: [
    "jsdom",
    "mammoth",
    "pdfjs-dist",
    "@mozilla/readability",
  ],
};

export default nextConfig;
