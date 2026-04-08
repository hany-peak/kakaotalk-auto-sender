/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        jquery: require.resolve('jquery'),
      };
    }
    return config;
  },
};

module.exports = nextConfig; 