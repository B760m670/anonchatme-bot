/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org" },
        ],
      },
    ];
  },
};
