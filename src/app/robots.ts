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
 * ─── `/me` : LA MÊME QUESTION, LA RÉPONSE INVERSE ──────────────────────────
 *
 * `/pro/` distingue une racine publique de ses enfants privés. `/me` n'a pas
 * cette forme : c'est la racine elle-même qui est privée — comme `/pro/baux`,
 * elle ne répond qu'une redirection vers la connexion — et c'est UN de ses
 * enfants, `/me/rejoindre`, qui doit rester explorable : c'est la page qui
 * explique comment obtenir un accès locataire, écrite précisément pour
 * quelqu'un qui n'a pas encore de compte.
 *
 * La barre finale ne suffit donc pas ici ; il faut fermer `/me` puis rouvrir
 * ce seul enfant. `Disallow: /me` bloque par préfixe `/me`, `/me/bail`,
 * `/me/loyers`, `/me/paiements`, `/me/preferences` ET `/me/rejoindre` — mais
 * `Allow: /me/rejoindre`, plus long donc plus spécifique, l'emporte sur lui
 * pour ce seul chemin (Robots Exclusion Standard : la règle la plus précise
 * gagne, et `Allow` l'emporte à égalité de longueur).
 *
 * `/me/invitation/<jeton>` reste fermé par ce même `Disallow: /me` — sans
 * carve-out. Rien ne le demandait : contrairement à `/me/rejoindre`, cette
 * page n'a aucune valeur de recherche (elle n'existe que pour qui détient déjà
 * un lien précis), et son URL porte un jeton — l'indexer publierait une trace
 * de ce jeton dans les journaux d'exploration.
 *
 * Le plan du site est déclaré ici plutôt que soumis à la main : Google le
 * découvre au premier passage, sans dépendre d'une action dans la Search
 * Console.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/me/rejoindre'],
      disallow: ['/pro/', '/me', '/api/', '/auth/'],
    },
    sitemap: 'https://sikaloc.com/sitemap.xml',
  }
}
