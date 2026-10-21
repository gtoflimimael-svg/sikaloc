import type { MetadataRoute } from 'next'
import { ARTICLES } from '@/lib/articles'
import { creerClientPublic } from '@/lib/supabase/public'

/**
 * Plan du site.
 *
 * Ne liste que les pages publiques et indexables. `/pro` en fait partie depuis
 * qu'il est devenu la présentation de Sikaloc_Pro ; tout ce qui vit SOUS
 * `/pro/` reste derrière une session — l'y faire figurer inviterait Google à
 * explorer des URL qui répondront par une redirection vers la connexion. Les
 * routes d'API n'ont rien à y faire non plus.
 *
 * `/find` y figure depuis S5 — le catalogue, sa première page seulement ; les
 * pages `?page=2…` ne s'indexent pas (`noindex`). Depuis S6, chaque annonce
 * PUBLIÉE y figure aussi, par sa fiche `/find/<référence>` : une seule lecture,
 * `annonces_publiees_sitemap`, qui ne rend que des annonces publiées.
 *
 * Absents à dessein : `/me`, qui exige une session ; et les anciennes adresses
 * `/app/...`, qui ne sont plus que des redirections.
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

/*
 * Recalculé à chaque demande, jamais figé au build : une annonce suspendue ou
 * clôturée ne doit pas rester annoncée aux moteurs pendant des heures. Les
 * robots lisent ce fichier rarement ; une lecture de base par visite est un
 * coût négligeable.
 */
export const dynamic = 'force-dynamic'

/** Les fiches publiées. Une erreur n'empêche pas le reste du plan d'être servi. */
async function fichesPubliees(): Promise<MetadataRoute.Sitemap> {
  const { data, error } = await creerClientPublic().rpc('annonces_publiees_sitemap')
  if (error) {
    console.error('[sitemap] annonces indisponibles', error.code, error.message)
    return []
  }
  return (data ?? []).map((a) => ({
    url: `${BASE}/find/${a.reference}`,
    lastModified: new Date(a.publiee_le),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Date fixe plutôt que `new Date()` : recalculée à chaque build, elle
  // annoncerait à Google une modification quotidienne du contenu légal, ce qui
  // est faux et finit par être ignoré.
  const derniereRevision = new Date('2026-08-23')
  // Les deux pages dont le contenu a réellement changé à la séparation des
  // espaces. Leur laisser la date d'août annoncerait à Google une page
  // d'accueil inchangée, alors qu'elle a été entièrement réécrite.
  const separationDesEspaces = new Date('2026-09-15')

  return [
    {
      url: `${BASE}/`,
      lastModified: separationDesEspaces,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      // La page de vente bailleur, qui vivait à `/` jusqu'à la séparation.
      url: `${BASE}/pro`,
      lastModified: separationDesEspaces,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      // Sans `lastModified` : le catalogue change à chaque publication. Une
      // date figée mentirait dès la première annonce ; `new Date()` mentirait
      // à chaque build. Mieux vaut ne rien affirmer.
      url: `${BASE}/find`,
      changeFrequency: 'daily',
      priority: 0.9,
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
      url: `${BASE}/blog`,
      lastModified: derniereRevision,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    // Une entrée par article, engendrée depuis la même source que les pages :
    // un plan du site tenu à la main finit toujours par annoncer une page morte,
    // comme ce fut le cas de `/exemple-quittance-gratuit`.
    ...ARTICLES.map((article) => ({
      url: `${BASE}/blog/${article.slug}`,
      lastModified: new Date(article.publieLe),
      changeFrequency: 'yearly' as const,
      priority: 0.5,
    })),
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
    ...(await fichesPubliees()),
  ]
}
