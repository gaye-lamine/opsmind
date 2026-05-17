import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@opsmind/shared"],
  output: "standalone",
};

export default nextConfig;
