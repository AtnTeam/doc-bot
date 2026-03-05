/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3100/api/:path*',
      },
    ];
  },
};
