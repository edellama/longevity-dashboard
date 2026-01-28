/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow xlsx library to work in API routes (Next.js 14 syntax)
    serverComponentsExternalPackages: ["xlsx"],
  },
};

module.exports = nextConfig;
