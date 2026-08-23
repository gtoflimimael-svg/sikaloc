import type { MetadataRoute } from 'next'

/**
 * Directives d'exploration.
 *
 * `/app/` et `/api/` sont fermés : le premier est derrière une session et ne
 * répondrait qu'une redirection, le second n'a aucun contenu à indexer. Les
 * fermer évite de dépenser le budget d'exploration de Google sur des impasses.
 *
 * `/auth/` l'est aussi : c'est la route de rappel d'authentification, elle
 * transporte des jetons dans son URL et n'a rien à faire dans un index.
 *
 * Le plan du site est déclaré ici plutôt que soumis à la main : Google le
 * découvre au premier passage, sans dépendre d'une action dans la Search
 * Console.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app/', '/api/', '/auth/'],
    },
    sitemap: 'https://sikaloc.com/sitemap.xml',
  }
}
