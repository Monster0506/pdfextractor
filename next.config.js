/** @type {import('next').NextConfig} */
const nextConfig = {
  // distDir: 'build',
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pdf-lib']
  }
}

module.exports = nextConfig
