import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // It is recommended to fix type errors before deploying.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
       // Optional: Add domain for Firebase Storage if you plan to use it for images
       // {
       //   protocol: 'https',
       //   hostname: 'firebasestorage.googleapis.com',
       // },
    ],
  },
};

export default nextConfig;
