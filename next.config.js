/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // This allows the Next.js dev server to accept requests from the
    // Firebase Studio preview environment.
    allowedDevOrigins: [
      'https://9000-firebase-studio-1766610453255.cluster-f73ibkkuije66wssuontdtbx6q.cloudworkstations.dev',
    ],
  },
  // This moves the Next.js build indicator to the bottom right
  // to avoid overlapping with the Firebase Studio UI.
  devIndicators: {
    buildActivityPosition: 'bottom-right',
  },
};

module.exports = nextConfig;
