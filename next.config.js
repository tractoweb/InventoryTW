/** @type {import('next').NextConfig} */
const forceStandalone = process.env.NEXT_OUTPUT === 'standalone' || process.env.NEXT_STANDALONE === 'true';

const nextConfig = {
  /* config options here */
  // NOTE: Some hosting providers (incl. Amplify depending on the runtime mode)
  // can be sensitive to `output: 'standalone'`. Keep it opt-in.
  output: forceStandalone ? 'standalone' : undefined,
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
