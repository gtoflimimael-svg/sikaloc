import type { MetadataRoute } from 'next'

/**
 * Plan du site.
 *
 * Ne liste que les pages publiques et indexables. Tout ce qui vit sous `/app`
 * est derrière une session — l'y faire figurer inviterait Google à explorer des
 * URL qui répondront par une redirection vers la connexion. Les routes d'API
 * n'ont rien à y faire non plus.
 *
 * `/connexion` est volontairement absente : elle n'apporte rien en recherche et
 * dilue le budget d'exploration. `/inscription` y figure, elle : c'est une page
 * de conversion, quelqu'un peut légitimement la trouver depuis Google.
 *
 * Les deux exemples de quittance sont inclus : ce sont de vrais documents
 * publics, et ils répondent à une intention de recherche réelle — « modèle
 * quittance loyer Bénin ».
 */

const BASE = 'https://sikaloc.com'

export default function sitemap(): MetadataRoute.Sitemap {
  // Date fixe plutôt que `new Date()` : recalculée à chaque build, elle
  // annoncerait à Google une modification quotidienne du contenu légal, ce qui
  // est faux et finit par être ignoré.
  const derniereRevision = new Date('2026-08-23')

  return [
    {
      url: `${BASE}/`,
      lastModified: derniereRevision,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE}/inscription`,
      lastModified: derniereRevision,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE}/exemple-quittance`,
      lastModified: derniereRevision,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      // Le pendant de l'exemple de quittance : un paiement partiel, avec son
      // solde imprimé. Il a remplacé `/exemple-quittance-gratuit`, route
      // supprimée avec la distinction entre plans qu'elle illustrait — et que
      // ce plan du site continuait d'annoncer aux moteurs, donc une 404.
      url: `${BASE}/exemple-recu`,
      lastModified: derniereRevision,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE}/legal/conditions`,
      lastModified: derniereRevision,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE}/legal/confidentialite`,
      lastModified: derniereRevision,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
