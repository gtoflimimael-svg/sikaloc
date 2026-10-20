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

const PAR_PAGE = 24

const TITRE = 'Logements à louer au Bénin — Sikaloc_Find'
const DESCRIPTION =
  'Appartements, maisons, studios et boutiques à louer au Bénin, publiés par leurs bailleurs sur ' +
  'Sikaloc. Loyer, charges, caution, équipements et disponibilité, sans adresse exacte.'

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

export default async function PageFind({ searchParams }: { searchParams: Promise<ParametresBruts> }) {
  const parametres = await searchParams
  if (parametres.page === '1') redirect(urlRecherche(lireFiltres(parametres)))
  const page = lireNumeroPage(parametres.page)
  if (page === null) notFound()

  const filtres = lireFiltres(parametres)
  const filtree = !aucunFiltre(filtres)
  const actifs = pastilles(filtres)

  const supabase = await creerClientServeur()
  const [utilisateur, { data, error }, lieux] = await Promise.all([
    obtenirUtilisateur(),
    supabase.rpc('annonces_recherche', argumentsRecherche(filtres, PAR_PAGE + 1, (page - 1) * PAR_PAGE)),
    supabase.rpc('lieux_publies'),
  ])

  if (error) console.error('[find] recherche indisponible', error.code, error.message)
  if (lieux.error) console.error('[find] lieux indisponibles', lieux.error.code, lieux.error.message)

  const recues = (data ?? []) as AnnoncePublique[]
  if (!error && page > 1 && recues.length === 0) notFound()

  const annonces = recues.slice(0, PAR_PAGE)
  const suivante = recues.length > PAR_PAGE
  // Une date par page, pas par carte : toutes disent « maintenant » au même instant.
  const aujourdhui = new Date().toISOString().slice(0, 10)

  return (
    <div className="min-h-screen bg-canvas-soft">
      <EnTeteFind connecte={Boolean(utilisateur)} />

      <main id="contenu" className="mx-auto max-w-[1200px] app-main">
        <header className="max-w-[46rem]">
          <h1 className="page-title">
            Logements à louer au Bénin
          </h1>
          <p className="mt-sm text-body-md text-body">
            Publiés par des bailleurs qui gèrent leurs biens sur Sikaloc. L’adresse exacte n’apparaît
            jamais sur une annonce.
          </p>
        </header>

        <div className="mt-xl grid gap-lg lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <FiltresFind filtres={filtres} lieux={lieux.data ?? []} nbFiltresActifs={actifs.length} />
          </div>

          <div className="min-w-0">
            {lieux.error ? <Alerte ton="attention">Les choix de lieux ne sont pas disponibles pour le moment. Les autres critères restent utilisables.</Alerte> : null}
            {actifs.length > 0 ? (
              <div className="mb-lg">
                <h2 className="sr-only">Filtres actifs</h2>
                <ul className="flex flex-wrap items-center gap-sm">
                  {actifs.map((p) => (
                    <li key={p.cle}>
                      <Link
                        href={p.href}
                        className="inline-flex min-h-11 items-center gap-xs rounded-pill border border-hairline bg-canvas px-md py-xs text-body-sm text-ink hover:border-hairline-strong"
                      >
                        {p.libelle}
                        <span aria-hidden="true">×</span>
                        <span className="sr-only">— retirer ce filtre</span>
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link href="/find" className="text-body-sm text-mute underline hover:text-ink">
                      Réinitialiser
                    </Link>
                  </li>
                </ul>
              </div>
            ) : null}

            {error ? (
              <Alerte ton="erreur">
                Le catalogue ne peut pas être affiché pour le moment. Réessayez dans un instant.
              </Alerte>
            ) : annonces.length === 0 ? (
              <section className="card card-lg">
                <h2 className="section-title">
                  {filtree ? 'Aucun logement ne correspond à ces critères' : 'Aucun logement publié pour le moment'}
                </h2>
                <p className="mt-sm text-body-md text-body">
                  {filtree
                    ? 'Élargissez votre recherche : un loyer plus haut, une autre ville, moins d’équipements.'
                    : 'Les logements que les bailleurs mettent en location sur Sikaloc apparaîtront ici, dès leur publication.'}
                </p>
                <div className="mt-lg flex flex-wrap gap-md">
                  {filtree ? (
                    <Link href="/find" className="btn btn-primary">
                      Réinitialiser les filtres
                    </Link>
                  ) : (
                    <>
                      <Link href="/" className="btn btn-secondary">
                        Découvrir Sikaloc
                      </Link>
                      <Link href="/pro" className="btn btn-tertiary">
                        Vous êtes bailleur ?
                      </Link>
                    </>
                  )}
                </div>
              </section>
            ) : (
              <>
                <p className="mb-md text-body-sm text-mute" role="status">{annonces.length} annonce{annonces.length > 1 ? 's' : ''} sur cette page{suivante ? ' · d’autres résultats à la page suivante' : ''}.</p>
                <ul className="grid gap-lg sm:grid-cols-2 xl:grid-cols-3" aria-label="Annonces">
                  {annonces.map((annonce, i) => (
                    <li key={annonce.reference}>
                      <CarteAnnonce annonce={annonce} aujourdhui={aujourdhui} prioritaire={i < 3} />
                    </li>
                  ))}
                </ul>

                {page > 1 || suivante ? (
                  <nav
                    aria-label="Pages du catalogue"
                    className="mt-2xl flex flex-wrap items-center justify-between gap-md"
                  >
                    {page > 1 ? (
                      <Link href={urlRecherche(filtres, page - 1)} className="btn btn-secondary" rel="prev">
                        ← Page précédente
                      </Link>
                    ) : (
                      <span />
                    )}
                    <p className="text-body-sm text-mute" aria-current="page">
                      Page {page}
                    </p>
                    {suivante ? (
                      <Link href={urlRecherche(filtres, page + 1)} className="btn btn-secondary" rel="next">
                        Page suivante →
                      </Link>
                    ) : (
                      <span />
                    )}
                  </nav>
                ) : null}
              </>
            )}
          </div>
        </div>
      </main>

      <PiedDePageFind />
    </div>
  )
}
