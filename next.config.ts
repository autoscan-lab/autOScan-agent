import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "lh4.googleusercontent.com",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "lh5.googleusercontent.com",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "lh6.googleusercontent.com",
        pathname: "/**",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
