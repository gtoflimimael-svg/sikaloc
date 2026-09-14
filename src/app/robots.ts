import type { MetadataRoute } from 'next'

/**
 * Directives d'exploration.
 *
 * `/pro/` et `/api/` sont fermés : le premier est derrière une session et ne
 * répondrait qu'une redirection, le second n'a aucun contenu à indexer. Les
 * fermer évite de dépenser le budget d'exploration de Google sur des impasses.
 *
 * ─── LA BARRE FINALE DE `/pro/` N'EST PAS UNE COQUETTERIE ──────────────────
 *
 * Une directive `Disallow` compare un PRÉFIXE de chemin. `/pro/` est un
 * préfixe de `/pro/baux` et de `/pro/impayes` ; il n'en est pas un de `/pro`,
 * qui est plus court et ne porte pas cette barre.
 *
 * Conséquence : les pages privées du bailleur restent hors de l'index, et
 * `/pro` reste explorable. C'est ce qui permettra à la page marketing de s'y
 * installer sans que rien ne bouge ici.
 *
 * Écrire `/pro` sans la barre retirerait la page de vente de Google. La
 * différence entre les deux tient à un caractère, et ne se voit sur aucun
 * écran.
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
      disallow: ['/pro/', '/api/', '/auth/'],
    },
    sitemap: 'https://sikaloc.com/sitemap.xml',
  }
}
