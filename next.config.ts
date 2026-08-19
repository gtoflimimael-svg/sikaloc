import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @react-pdf/renderer embarque des binaires de police et du code CJS qui ne
  // supportent pas le bundling serveur — on le laisse en require() natif.
  serverExternalPackages: ['@react-pdf/renderer'],
  experimental: {
    serverActions: {
      // Les signatures uploadées sont limitées à 2 Mo côté applicatif.
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
