import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // env: {
  //   APP_URL: process.env.NEXT_PUBLIC_BASE_URL,
  // },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zlowucgjecrlilkyoamr.supabase.co",
        pathname: "/storage/v1/object/public/**"
      },
    ],
  },
};

export default nextConfig;