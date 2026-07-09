import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Node-only ingestion deps as require()-at-runtime instead of bundled.
  // mammoth touches Node fs; pdfjs-dist uses a worker load path that breaks
  // when bundled by Turbopack.
  serverExternalPackages: ["mammoth", "pdfjs-dist"],
};

export default nextConfig;
