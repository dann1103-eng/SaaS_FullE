import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los packages del monorepo exportan TypeScript fuente (sin build propio).
  transpilePackages: ["@plataforma/core", "@plataforma/db"],
};

export default nextConfig;
