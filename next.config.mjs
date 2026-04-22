/** @type {import('next').NextConfig} */
// Force reload after cache clear
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['192.168.1.111'],
  outputFileTracingIncludes: {
    "/*": ["./service-account.json"],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.prebuiltui.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/map-cctv",
        destination: "/cctv-map",
      },
    ];
  },
};

export default nextConfig;
