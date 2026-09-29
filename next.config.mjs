/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // Proxy mọi request /api/* sang backend NestJS (kaylee-api).
    // Nhờ đó cookie session admin vẫn là first-party, không cần cấu hình CORS/credentials rườm rà.
    // Trên Vercel: set biến môi trường API_URL trỏ tới API (VD: http://<vps>:3001).
    const apiUrl = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]
  },
}

export default nextConfig
