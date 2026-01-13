/** @type {import('next').NextConfig} */
const isWindows = process.platform === 'win32';
const forceStandalone = process.env.NEXT_OUTPUT === 'standalone' || process.env.NEXT_STANDALONE === 'true';

const nextConfig = {
  /* config options here */
  // NOTE: `output: 'standalone'` uses file tracing and may require symlink
  // permissions on Windows (pnpm + symlinks => EPERM). We keep standalone for
  // non-Windows builds, and allow forcing it via env vars when needed.
  output: forceStandalone || !isWindows ? 'standalone' : undefined,
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

  // This moves the Next.js build indicator to the bottom right
  // to avoid overlapping with the Firebase Studio UI.
  devIndicators: {
    buildActivityPosition: 'bottom-right',
  },
};

module.exports = nextConfig;
