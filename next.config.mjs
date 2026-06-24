/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [],
  serverExternalPackages: ["esbuild", "better-sqlite3"],
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "esbuild"],
  },
};

export default nextConfig;