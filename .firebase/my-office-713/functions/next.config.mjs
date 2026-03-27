// next.config.mjs
var nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.prebuiltui.com"
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com"
      }
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups"
          }
        ]
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: "/map-cctv",
        destination: "/cctv-map"
      }
    ];
  }
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};
