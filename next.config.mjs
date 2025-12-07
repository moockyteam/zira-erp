/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ajout de cette section pour contourner le bogue de source map avec Turbopack
  experimental: {
    serverSourceMaps: false,
  },

  // Vos configurations existantes sont conservées
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig