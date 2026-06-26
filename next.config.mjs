/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  basePath,
  output: "standalone",
  transpilePackages: [],
  serverExternalPackages: ["esbuild", "better-sqlite3"],
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "esbuild"],
  },
};

export default nextConfig;