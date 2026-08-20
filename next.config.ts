import type { NextConfig } from 'next'

/**
 * Politique de sécurité du contenu (CSP) — spec §9 « protéger le site contre
 * toute tentative de piratage ».
 *
 * Choix délibéré : PAS de nonce par requête. Un CSP à base de nonce oblige
 * Next.js à rendre chaque page dynamiquement (voir la doc `content-security-
 * policy.md`) — ce qui désactiverait la génération statique et le cache CDN
 * sur les pages publiques (accueil, mentions légales, connexion), à l'exact
 * opposé de la correction §9 « fluidité, que le site réponde vite ». La
 * variante statique ci-dessous garde `'unsafe-inline'` sur les scripts et les
 * styles, mais conserve l'essentiel de la protection : aucune ressource
 * tierce ne peut être chargée (`default-src 'self'`), aucun plugin ni objet
 * intégré (`object-src 'none'`), aucun habillage en iframe par un site tiers
 * (`frame-ancestors 'none'`), aucune soumission de formulaire vers l'extérieur
 * (`form-action 'self'`).
 *
 * `'unsafe-inline'` reste un compromis assumé plutôt qu'un oubli : l'audit du
 * code n'a trouvé que deux `dangerouslySetInnerHTML`
 * (`src/components/ui/illustration.tsx`, `src/app/layout.tsx`), tous deux sur
 * du contenu statique écrit par l'équipe, jamais sur une entrée utilisateur —
 * la surface XSS réelle que ce relâchement expose est donc quasi nulle.
 */
const isDev = process.env.NODE_ENV === 'development'

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, ' ')
  .trim()

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
  // `document-quittance.tsx` lit les fichiers de police de marque sur le
  // disque à l'exécution (voir son commentaire d'en-tête) : un chemin construit
  // dynamiquement (`path.join(process.cwd(), …)`) n'est pas repéré par le
  // traçage statique de Next.js, donc les .ttf/.otf ne suivraient pas dans le
  // paquet déployé sans cette inclusion explicite.
  outputFileTracingIncludes: {
    '/*': ['./src/app/fonts/Copernicus-*.ttf', './src/app/fonts/StyreneB-*.otf'],
  },
  async headers() {
    return [
      {
        // Toutes les routes : les API et les pages méritent la même
        // protection contre le sniff de type MIME et le clickjacking.
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            // Aucune capacité navigateur ouverte par défaut. `camera=(self)`
            // est la seule exception : le scan de signature (§6.1.10) en a
            // besoin, sur nos propres pages uniquement — jamais dans une
            // iframe tierce.
            key: 'Permissions-Policy',
            value:
              'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
          {
            // HTTPS forcé pendant 2 ans, sous-domaines compris. `preload`
            // suppose l'inscription sur hstspreload.org — sans danger à
            // publier avant cette étape, juste sans effet tant qu'elle n'est
            // pas faite.
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
