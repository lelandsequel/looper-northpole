/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["luna-engine", "strata-v1"],
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;