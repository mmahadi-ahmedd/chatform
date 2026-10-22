/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Widget page must be embeddable in iframes on other sites
        source: "/widget/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        source: "/embed.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
    ];
  },
};
export default nextConfig;
