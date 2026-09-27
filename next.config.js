/** @type {import('next').NextConfig} */
const nextConfig = {
  // No "output: standalone" here — the OpenNext Cloudflare adapter
  // (@opennextjs/cloudflare) builds straight from the default Next.js
  // output and produces its own Worker bundle. "standalone" is for a
  // Node server (e.g. the Dockerfile path) and conflicts with that build.
  reactStrictMode: true
};

module.exports = nextConfig;
