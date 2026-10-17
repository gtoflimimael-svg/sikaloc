import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { Galerie } from '@/components/find/galerie'
import { EnTeteFind, PiedDePageFind } from '@/components/find/navigation'
import { LIBELLES_EQUIPEMENT, libelleChambres } from '@/lib/annonces/libelles'
import { formaterDate, formaterFCFA } from '@/lib/format'
import { creerClientServeur, obtenirUtilisateur } from '@/lib/supabase/serveur'
import type { AnnoncePublique, PhotoPublique, ProfilPublicBailleur } from '@/lib/types/database'

/**
 * La fiche publique d'une annonce Sikaloc_Find.
 *
 * ─── Trois fonctions, aucune table ─────────────────────────────────────────
 *
 * `annonce_publiee`, `photos_publiees`, `profil_public_bailleur` : rien d'autre.
 * Ce que la page affiche est ce qu'elles énumèrent. L'adresse, le bailleur, le
 * bail n'y sont pas — la page ne peut pas les montrer.
 *
 * ─── Une seule réponse pour « non » ────────────────────────────────────────
 *
 * Référence mal formée, inconnue, annonce en brouillon, suspendue, clôturée
 * ou supprimée : `notFound()`, la même 404. La fonction ne distingue pas ces
 * cas, et la page non plus.
 *
 * ─── Pas de cache de page ──────────────────────────────────────────────────
 *
 * Rendue à chaque requête (elle lit la session, pour l'en-tête). Une annonce
 * suspendue ou clôturée cesse d'être servie dès la requête suivante.
 */

const REFERENCE = /^[0-9a-hjkmnp-tv-z]{10}$/

type Fiche = {
  annonce: AnnoncePublique
  photos: PhotoPublique[]
  profil: ProfilPublicBailleur | null
}

/**
 * Partagé entre `generateMetadata` et la page : `cache` de React ne lit la
 * base qu'une fois par requête.
 */
const chargerFiche = cache(async (reference: string): Promise<Fiche | null> => {
  if (!REFERENCE.test(reference)) return null

  const supabase = await creerClientServeur()
  const [annonce, photos, profil] = await Promise.all([
    supabase.rpc('annonce_publiee', { p_reference: reference }),
    supabase.rpc('photos_publiees', { p_reference: reference }),
    supabase.rpc('profil_public_bailleur', { p_reference: reference }),
  ])

  const erreur = annonce.error ?? photos.error ?? profil.error
  if (erreur) {
    // Une panne est distincte d’une référence inconnue ; le détail SQL reste privé.
    console.error('[find] fiche indisponible', reference, erreur.code, erreur.message)
    throw new Error('La fiche ne peut pas être chargée pour le moment.')
  }

  const ligne = (annonce.data ?? [])[0] as AnnoncePublique | undefined
  if (!ligne) return null

  return {
    annonce: ligne,
    photos: (photos.data ?? []) as PhotoPublique[],
    profil: ((profil.data ?? [])[0] as ProfilPublicBailleur | undefined) ?? null,
  }
})

/** « Appartement · 2 chambres salon » */
function intitule(a: AnnoncePublique): string {
  const chambres = libelleChambres(a.chambres)
  return chambres ? `${a.type} · ${chambres}` : a.type
}

const lieu = (a: AnnoncePublique) => (a.quartier ? `${a.quartier}, ${a.ville}` : a.ville)

function disponibilite(disponibleLe: string | null): string {
  const aujourdhui = new Date().toISOString().slice(0, 10)
  if (!disponibleLe || disponibleLe <= aujourdhui) return 'Disponible maintenant'
  return `Disponible le ${formaterDate(disponibleLe)}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reference: string }>
}): Promise<Metadata> {
  const { reference } = await params
  const fiche = await chargerFiche(reference)
  // La 404 ne dit rien de l'annonce : pas même un titre.
  if (!fiche) return { title: 'Annonce introuvable', robots: { index: false, follow: true } }

  const { annonce: a } = fiche
  const titre = `${intitule(a)} à louer à ${lieu(a)}`
  const description =
    `${a.type} à louer à ${lieu(a)} : ${formaterFCFA(a.loyer)} par mois. ` +
    `${disponibilite(a.disponible_le)}. Annonce publiée sur Sikaloc_Find, réf. ${a.reference}.`
  const url = `/find/${a.reference}`
  const image =
    a.photo_position !== null
      ? [
          {
            url: `/find/photo/${a.reference}/${a.photo_position}`,
            width: a.photo_largeur ?? undefined,
            height: a.photo_hauteur ?? undefined,
            alt: `${intitule(a)} à louer — ${lieu(a)}`,
          },
        ]
      : undefined

  return {
    title: titre,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      siteName: 'Sikaloc',
      url,
      title: titre,
      description,
      images: image,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: titre,
      description,
      images: image?.map((i) => i.url),
    },
  }
}

export default async function PageFiche({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params
  const [fiche, utilisateur] = await Promise.all([chargerFiche(reference), obtenirUtilisateur()])
  if (!fiche) notFound()

  const { annonce: a, photos, profil } = fiche
  const titre = intitule(a)
  const equipements = a.equipements.filter((e) => e in LIBELLES_EQUIPEMENT)

  const caracteristiques: [string, string][] = [
    ['Type', a.type],
    ...(a.chambres !== null ? [['Pièces', libelleChambres(a.chambres)!] as [string, string]] : []),
    ...(a.surface_m2 !== null ? [['Surface', `${a.surface_m2} m²`] as [string, string]] : []),
    ['Localisation', lieu(a)],
  ]

  const conditions: [string, string][] = [
    ['Loyer', `${formaterFCFA(a.loyer)} / mois`],
    ...(a.charges === null
      ? []
      : a.charges === 0
        ? [['Charges', 'Sans charges'] as [string, string]]
        : [['Charges', `+ ${formaterFCFA(a.charges)} / mois de charges`] as [string, string]]),
    ...(a.depot_garantie !== null
      ? [['Dépôt de garantie', formaterFCFA(a.depot_garantie)] as [string, string]]
      : []),
    ...(a.avance_mois === null
      ? []
      : [['Avance', a.avance_mois === 0 ? 'Aucune avance' : `${a.avance_mois} mois`] as [string, string]]),
  ]

  return (
    <div className="min-h-screen bg-canvas-soft">
      <EnTeteFind connecte={Boolean(utilisateur)} />

      <main id="contenu" className="mx-auto max-w-[1200px] app-main">
        <Link href="/find" className="text-body-sm text-mute hover:text-ink">
          ← Tous les logements
        </Link>

        <header className="mt-lg">
              <p className="text-caption font-medium text-mute">
                {a.type} à louer
              </p>
              <h1 className="mt-xs page-title">
                {titre}
              </h1>
              <p className="mt-xs text-body-lg text-body">{lieu(a)}</p>
          <div className="mt-md flex flex-wrap items-center justify-between gap-md lg:hidden">
            <p className="text-title-lg font-semibold money text-ink">{formaterFCFA(a.loyer)} <span className="text-body-sm font-normal text-mute">/ mois</span></p>
            <Link href={`/find/${a.reference}/candidater`} className="btn btn-primary">Candidater</Link>
          </div>
        </header>
        <div className="mt-lg grid gap-2xl lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-2xl">
            <Galerie
              reference={a.reference}
              photos={photos}
              photoPrincipale={a.photo_position}
              description={`${titre} à louer — ${lieu(a)}`}
            />



            <section aria-labelledby="titre-infos">
              <h2 id="titre-infos" className="section-title">
                Le logement
              </h2>
              <dl className="card list-card mt-md grid gap-lg sm:grid-cols-2">
                {caracteristiques.map(([terme, valeur]) => (
                  <div key={terme} className="min-w-0">
                    <dt className="text-body-sm text-mute">{terme}</dt>
                    <dd className="list-copy text-body-md font-medium text-ink">{valeur}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {equipements.length > 0 ? (
              <section aria-labelledby="titre-equipements">
                <h2 id="titre-equipements" className="section-title">
                  Équipements
                </h2>
                <ul className="mt-md flex flex-wrap gap-sm">
                  {equipements.map((e) => (
                    <li key={e} className="badge badge-neutral">
                      {LIBELLES_EQUIPEMENT[e]}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {a.description ? (
              <section aria-labelledby="titre-description">
                <h2 id="titre-description" className="section-title">
                  Description
                </h2>
                {/* Du texte, jamais du HTML : la description est écrite par le bailleur. */}
                <p className="mt-md list-copy whitespace-pre-line text-body-md text-body">{a.description}</p>
              </section>
            ) : null}
          </div>

          <aside className="space-y-lg lg:sticky lg:top-24 lg:self-start">
            <section aria-labelledby="titre-prix" className="card card-lg">
              <h2 id="titre-prix" className="sr-only">
                Prix et disponibilité
              </h2>
              <p className="flex flex-wrap items-baseline gap-xs text-title-lg font-semibold text-ink">
                <span className="money">{formaterFCFA(a.loyer)}</span>
                <span className="text-body-md font-normal text-mute"> / mois</span>
              </p>
              <p className="mt-xs text-body-md font-semibold text-ink">{disponibilite(a.disponible_le)}</p>

              <h3 className="mt-lg text-body-sm font-medium text-mute">
                Conditions financières
              </h3>
              <dl className="mt-sm space-y-xs text-body-sm">
                {conditions.map(([terme, valeur]) => (
                  <div key={terme} className="flex flex-col gap-xxs">
                    <dt className="text-mute">{terme}</dt>
                    <dd className="font-medium text-ink">{valeur}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {profil?.nom_affiche ? (
              <section aria-labelledby="titre-bailleur" className="card">
                <h2 id="titre-bailleur" className="text-body-sm font-medium text-mute">
                  Publiée par
                </h2>
                <p className="mt-xs text-body-md font-semibold text-ink">{profil.nom_affiche}</p>
                {profil.telephone_verifie ? (
                  <p className="mt-sm">
                    <span className="badge badge-positive">Téléphone vérifié</span>
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="card space-y-md text-body-sm text-body">
              <Link href={`/find/${a.reference}/candidater`} className="btn btn-primary w-full">
                Candidater
              </Link>
              <p>
                Le bailleur verra votre nom et votre message. Ni votre téléphone, ni votre email ne
                lui sont transmis, et Sikaloc ne garantit pas de réponse.
              </p>
              <p className="mt-sm font-semibold text-ink">Réf. {a.reference}</p>
              {a.publiee_le ? (
                <p className="mt-xxs text-mute">Publiée le {formaterDate(a.publiee_le)}</p>
              ) : null}
            </section>
          </aside>
        </div>

        <div className="mt-3xl">
          <Link href="/find" className="btn btn-secondary">
            ← Retour aux logements
          </Link>
        </div>
      </main>

      <PiedDePageFind />
    </div>
  )
}
