/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [{ source: "/internal/:path*", destination: "/api/internal/:path*" }];
  },
};
export default nextConfig;
