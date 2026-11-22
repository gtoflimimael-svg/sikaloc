import type { NextConfig } from 'next'
import { isMaintenanceEnabled } from './src/lib/maintenance-policy.mjs'

/**
 * Politique de sécurité du contenu (CSP) — spec §9.
 *
 * Elle n'est plus posée ici : le proxy (`src/proxy.ts`) tire un nonce par
 * requête et pose l'en-tête via `src/lib/csp.ts` (SEC-02). Les scripts n'ont
 * donc plus `'unsafe-inline'`. Le nonce impose un rendu dynamique ; c'était
 * déjà le cas de toutes les pages, puisque le proxy lit la session à chaque
 * requête. Les fichiers statiques exclus du proxy (JS, images) n'en ont pas
 * besoin.
 */
const maintenanceActive = isMaintenanceEnabled(process.env.SIKALOC_MAINTENANCE_MODE)

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
  // `pdf/base.tsx` lit les polices statiques Manrope et Inter sur le disque à l'exécution
  // (voir son commentaire d'en-tête) : un chemin construit
  // dynamiquement (`path.join(process.cwd(), …)`) n'est pas repéré par le
  // traçage statique de Next.js, donc les .ttf/.otf ne suivraient pas dans le
  // paquet déployé sans cette inclusion explicite.
  // `src/lib/types/database.ts` est LU À L'EXÉCUTION par le contrôle de schéma
  // (`src/lib/schema.ts`) : c'est la description du schéma dont le code se sert,
  // et la comparer suppose de la lire telle qu'elle est écrite. Comme pour les
  // polices, un chemin construit dynamiquement échappe au traçage statique.
  outputFileTracingIncludes: {
    '/*': [
      './src/app/fonts/Inter-PDF-*.ttf',
      './src/app/fonts/Inter-OFL.txt',
      './src/app/fonts/Manrope-PDF-*.ttf',
      './src/app/fonts/Manrope-OFL.txt',
      './public/marque/sikaloc-officiel-noir.svg',
      './public/documents/exemple-quittance-sikaloc.pdf',
    ],
    // Le contrôle de schéma lit ce fichier pour connaître les colonnes
    // attendues. Les objets (contraintes, politiques…) passaient par le même
    // mécanisme, mais les migrations n'arrivaient pas dans la fonction
    // déployée : leur liste est désormais figée au build par
    // `npm run generer:objets`, et embarquée comme un import ordinaire.
    '/api/cron/schema': ['./src/lib/types/database.ts'],
  },
  /**
   * Les anciennes adresses de Sikaloc_Pro.
   *
   * ─── Ce que ces trois lignes protègent ─────────────────────────────────
   *
   * Des bailleurs détiennent, dans des emails de relance d'abonnement déjà
   * partis, des liens vers `/app/parametres/abonnement`. Sans cette
   * redirection, cliquer « Régler mon abonnement » mène à une page
   * introuvable — au moment précis où on leur demande de payer.
   *
   * S'y ajoutent les favoris, l'historique des navigateurs, et l'index de
   * Google.
   *
   * ─── Pourquoi 308 et pas 301 ───────────────────────────────────────────
   *
   * `permanent: true` produit un 308, et c'est le bon choix pour deux raisons
   * que la documentation de cette version explique :
   *
   *   • 301 et 302 laissent les navigateurs changer la méthode en GET. 307 et
   *     308 la PRÉSERVENT. Or les Server Actions de Next sont des POST vers
   *     l'URL de la page — un formulaire soumis depuis un onglet resté ouvert
   *     sur `/app/...` serait silencieusement dégradé en GET, et la
   *     soumission perdue sans message.
   *   • Pour les moteurs, un 308 vaut un 301 : l'autorité est transférée et
   *     l'adresse remplacée à l'index.
   *
   * ─── Les paramètres d'URL suivent ──────────────────────────────────────
   *
   * Next passe la chaîne de requête à la destination sans qu'on ait à le
   * demander. `/app/paiements?bail=xxx` arrive donc sur
   * `/pro/paiements?bail=xxx` — ce qui compte pour les liens internes du
   * produit, qui transportent des identifiants.
   *
   * ─── Une seule règle suffit ────────────────────────────────────────────
   *
   * Le modificateur `*` signifie « zéro ou plus » : `/app/:chemin*` couvre
   * `/app` lui-même ET tous ses descendants.
   */
  async redirects() {
    // Les redirects du fichier de configuration sont exécutées avant Proxy.
    // Les suspendre en maintenance garantit notamment un 503 direct sur les
    // anciennes URL `/app/*`, sans détour ni redirection.
    if (maintenanceActive) return []

    return [
      {
        source: '/app/:chemin*',
        destination: '/pro/:chemin*',
        permanent: true,
      },
    ]
  },

  async headers() {
    return [
      {
        // Toutes les routes : les API et les pages méritent la même
        // protection contre le sniff de type MIME et le clickjacking.
        source: '/:path*',
        headers: [
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
      // Seuls les PDF fictifs peuvent être intégrés dans les aperçus Sikaloc.
      // Leur ouverture reste interdite depuis les pages d'une autre origine.
      ...['/exemple-quittance', '/exemple-recu'].map((source) => ({
        source,
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      })),
    ]
  },
}

export default nextConfig
