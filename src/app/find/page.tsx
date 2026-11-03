import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { CarteAnnonce } from '@/components/find/carte-annonce'
import { FiltresFind } from '@/components/find/filtres'
import { EnTeteFind, PiedDePageFind } from '@/components/find/navigation'
import { Alerte } from '@/components/ui/retours'
import {
  argumentsRecherche,
  aucunFiltre,
  lireFiltres,
  pastilles,
  urlRecherche,
  type ParametresBruts,
} from '@/lib/find/recherche'
import { creerClientServeur, obtenirUtilisateur } from '@/lib/supabase/serveur'
import { lireNumeroPage } from '@/lib/pagination'
import type { AnnoncePublique } from '@/lib/types/database'

/**
 * Sikaloc_Find — le catalogue, et sa recherche.
 *
 * ─── Une seule source, un seul chemin ──────────────────────────────────────
 *
 * `annonces_recherche`, la fonction de S7. Sans filtre, elle rend exactement
 * le catalogue de S5 : même projection, même tri, même plafond. La page n'a
 * donc pas deux comportements à tenir — celui du catalogue et celui de la
 * recherche sont le même. Jamais `from('annonces')`.
 *
 * ─── La pagination sans total ──────────────────────────────────────────────
 *
 * On demande UNE annonce de plus que la page n'en montre : si elle arrive, il
 * existe une page suivante. Aucun total n'est calculé, ni affiché.
 *
 * ─── Les filtres et l'URL ──────────────────────────────────────────────────
 *
 * Tout est dans l'adresse : une recherche se partage, se recharge, et le
 * bouton « Précédent » fonctionne. Les valeurs douteuses sont ignorées (voir
 * `lib/find/recherche.ts`) ; seule une `page` qui n'en est pas une répond 404.
 */

// Valider l’URL avant les lectures garantit les vraies réponses 404. Le GET
// natif annonce sa recherche en cours sans diffuser un document partiel.
const PAR_PAGE = 24

const TITRE = 'Logements à louer au Bénin — Sikaloc_Find'
const DESCRIPTION =
  'Explorez les logements disponibles au Bénin, comparez leurs caractéristiques et trouvez celui qui correspond à vos besoins.'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ParametresBruts>
}): Promise<Metadata> {
  const parametres = await searchParams
  const page = lireNumeroPage(parametres.page)
  const filtres = lireFiltres(parametres)
  const filtree = !aucunFiltre(filtres)

  return {
    title: { absolute: page && page > 1 ? `Page ${page} · ${TITRE}` : TITRE },
    description: DESCRIPTION,
    /*
     * Une seule adresse à indexer : `/find`. Une recherche filtrée est un
     * outil, pas une page éditoriale — l'indexer multiplierait les adresses
     * sans rien apporter, et chacune prétendrait être une page à part sur un
     * contenu qui change à chaque publication.
     */
    alternates: { canonical: '/find' },
    robots: filtree || (page && page > 1) ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      siteName: 'Sikaloc',
      url: '/find',
      title: TITRE,
      description: DESCRIPTION,
    },
    twitter: { card: 'summary', title: TITRE, description: DESCRIPTION },
  }
}

async function chargerCatalogue(filtres: ReturnType<typeof lireFiltres>, page: number) {
  const supabase = await creerClientServeur()
  const [{ data, error }, lieux] = await Promise.all([
    supabase.rpc('annonces_recherche', argumentsRecherche(filtres, PAR_PAGE + 1, (page - 1) * PAR_PAGE)),
    supabase.rpc('lieux_publies'),
  ])

  if (error) console.error('[find] recherche indisponible', error.code, error.message)
  if (lieux.error) console.error('[find] lieux indisponibles', lieux.error.code, lieux.error.message)

  return { data, error, lieux: lieux.data ?? [], erreurLieux: lieux.error }
}

type ResultatCatalogue = Awaited<ReturnType<typeof chargerCatalogue>>

function ResultatsCatalogue({
  filtres,
  page,
  resultats,
}: {
  filtres: ReturnType<typeof lireFiltres>
  page: number
  resultats: ResultatCatalogue
}) {
  const filtree = !aucunFiltre(filtres)
  const actifs = pastilles(filtres)
  const annoncesRecues = (resultats.data ?? []) as AnnoncePublique[]
  const annoncesErreur = resultats.error
  const annonces = annoncesRecues.slice(0, PAR_PAGE)
  const suivante = annoncesRecues.length > PAR_PAGE
  // Une date par page, pas par carte : toutes disent « maintenant » au même instant.
  const aujourdhui = new Date().toISOString().slice(0, 10)

  return (
    <>
      <section aria-label="Recherche de logements" className="find-catalog-search-section">
        <FiltresFind filtres={filtres} lieux={resultats.lieux} nbFiltresActifs={actifs.length} />
      </section>

      <section className="find-catalog-results" aria-labelledby="find-results-title">
        <div className="find-results-heading">
          <div>
            <p className="find-results-eyebrow">Le catalogue</p>
            <h2 id="find-results-title">Logements disponibles</h2>
          </div>
          <p className="find-privacy-note">Les adresses exactes restent privées.</p>
        </div>

        {resultats.erreurLieux ? <Alerte ton="attention">Les choix de lieux ne sont pas disponibles pour le moment. Les autres critères restent utilisables.</Alerte> : null}
        {actifs.length > 0 ? (
          <div className="find-active-filters">
            <h3 className="sr-only">Filtres actifs</h3>
            <ul>
              {actifs.map((p) => (
                <li key={p.cle}>
                  <Link href={p.href}>
                    {p.libelle}<span aria-hidden="true">×</span><span className="sr-only"> — retirer ce filtre</span>
                  </Link>
                </li>
              ))}
              <li><Link href="/find" className="find-clear-filters">Tout effacer</Link></li>
            </ul>
          </div>
        ) : null}

        {annoncesErreur ? (
          <div className="find-catalog-error">
            <Alerte ton="erreur">Le catalogue ne peut pas être affiché pour le moment. Aucun résultat n’est confirmé.</Alerte>
            <Link href={urlRecherche(filtres, page)} className="btn btn-secondary">Réessayer la recherche</Link>
          </div>
        ) : annonces.length === 0 ? (
          <section className="find-empty-state">
            <p className="find-results-eyebrow">Votre recherche</p>
            <h2>{filtree ? 'Aucun logement ne correspond à votre recherche.' : 'Aucun logement publié pour le moment.'}</h2>
            <p>
              {filtree
                ? 'Essayez d’élargir votre budget, de choisir une autre ville ou de retirer un équipement.'
                : 'Les logements publiés par les bailleurs apparaîtront ici dès leur mise en ligne.'}
            </p>
            {filtree ? <Link href="/find" className="btn btn-primary">Réinitialiser les filtres</Link> : null}
          </section>
        ) : (
          <>
            <p className="find-results-count" role="status">
              {suivante
                ? `${annonces.length} logements affichés sur cette page`
                : `${annonces.length} logement${annonces.length > 1 ? 's' : ''} trouvé${annonces.length > 1 ? 's' : ''}`}
            </p>
            <ul className="find-property-grid" aria-label="Annonces disponibles">
              {annonces.map((annonce, index) => (
                <li key={annonce.reference}>
                  <CarteAnnonce annonce={annonce} aujourdhui={aujourdhui} prioritaire={index < 3} />
                </li>
              ))}
            </ul>

            {page > 1 || suivante ? (
              <nav aria-label="Pages du catalogue" className="find-pagination">
                {page > 1 ? (
                  <Link href={urlRecherche(filtres, page - 1)} className="btn btn-secondary" rel="prev">← Page précédente</Link>
                ) : <span />}
                <p aria-current="page">Page {page}</p>
                {suivante ? (
                  <Link href={urlRecherche(filtres, page + 1)} className="btn btn-secondary" rel="next">Page suivante →</Link>
                ) : <span />}
              </nav>
            ) : null}
          </>
        )}
      </section>
    </>
  )
}

export default async function PageFind({ searchParams }: { searchParams: Promise<ParametresBruts> }) {
  const parametres = await searchParams
  if (parametres.page === '1') redirect(urlRecherche(lireFiltres(parametres)))
  const page = lireNumeroPage(parametres.page)
  if (page === null) notFound()

  const filtres = lireFiltres(parametres)
  const utilisateurPromise = obtenirUtilisateur()

  // Vérifier les pages au-delà de la première avant le rendu : une pagination
  // inexistante doit rester une vraie 404, même si le catalogue est diffusé.
  const resultatInitial = await chargerCatalogue(filtres, page)
  if (page > 1 && !resultatInitial.error && (resultatInitial.data ?? []).length === 0) notFound()
  const utilisateur = await utilisateurPromise

  return (
    <div className="find-catalog-page min-h-screen bg-canvas">
      <EnTeteFind connecte={Boolean(utilisateur)} />

      <main id="contenu" className="find-catalog-main mx-auto max-w-[1320px]">
        <header className="find-catalog-intro">
          <p className="find-catalog-eyebrow">Catalogue immobilier <span aria-hidden="true">·</span> Bénin</p>
          <h1>Trouvez un logement qui vous ressemble.</h1>
          <p className="find-catalog-description">
            Explorez les logements disponibles au Bénin, comparez leurs caractéristiques et trouvez celui qui correspond à vos besoins.
          </p>
        </header>

        <ResultatsCatalogue filtres={filtres} page={page} resultats={resultatInitial} />
      </main>

      <PiedDePageFind />
    </div>
  )
}
