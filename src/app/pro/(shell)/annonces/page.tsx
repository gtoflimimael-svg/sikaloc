import type { Metadata } from 'next'
import Link from 'next/link'

import { Illustration } from '@/components/ui/illustration'
import { Badge, EnTetePage, EtatVide } from '@/components/ui/retours'
import { LIBELLES_MOTIF, LIBELLES_STATUT, TON_STATUT, libelleChambres } from '@/lib/annonces/libelles'
import { formaterDate, formaterFCFA } from '@/lib/format'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Annonce, CompteurCandidatures } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Annonces' }

type LigneAnnonce = Pick<
  Annonce,
  | 'id'
  | 'reference'
  | 'statut'
  | 'motif_cloture'
  | 'type'
  | 'ville'
  | 'quartier'
  | 'chambres'
  | 'loyer'
  | 'disponible_le'
  | 'cloturee_le'
> & { annonce_photos: { id: string; position: number }[] }

/** Les annonces vivantes d'abord ; les clôturées sont un historique. */
const RANG = { publiee: 0, suspendue: 1, brouillon: 2, cloturee: 3 } as const

export default async function PageAnnonces() {
  const supabase = await creerClientServeur()

  // Scopée par la session : les politiques de S1 ne rendent que les annonces
  // du bailleur connecté.
  // Une requête pour les annonces, une pour TOUS les décomptes : compter
  // annonce par annonce ferait une requête de plus par carte affichée.
  const [, { data }, { data: compteurs }] = await Promise.all([
    bailleurOnboarde(),
    supabase
      .from('annonces')
      .select(
        'id, reference, statut, motif_cloture, type, ville, quartier, chambres, loyer, disponible_le, cloturee_le, annonce_photos(id, position)',
      )
      .order('created_at', { ascending: false }),
    supabase.rpc('candidatures_par_annonce'),
  ])

  const annonces = ((data ?? []) as unknown as LigneAnnonce[]).sort(
    (a, b) => RANG[a.statut] - RANG[b.statut],
  )

  // Une annonce absente du décompte n'a reçu aucune candidature.
  const recues = new Map<string, CompteurCandidatures>(
    ((compteurs ?? []) as CompteurCandidatures[]).map((c) => [c.annonce_id, c]),
  )

  return (
    <div>
      <EnTetePage
        titre="Annonces"
        description="Vos logements mis en location sur Sikaloc_Find."
        action={
          <Link href="/pro/annonces/nouvelle" className="btn btn-primary">
            Créer une annonce
          </Link>
        }
      />

      {annonces.length === 0 ? (
        <EtatVide
          icone={<Illustration nom="plante" taille={200} decorative />}
          titre="Aucune annonce"
          description="Un logement libre, ou qui le sera bientôt, peut être proposé à la location : préparez son annonce, ajoutez des photos, puis publiez-la."
          action={
            <Link href="/pro/annonces/nouvelle" className="btn btn-primary">
              Créer une annonce
            </Link>
          }
        />
      ) : (
        <div className="grid gap-md md:grid-cols-2">
          {annonces.map((annonce) => {
            const principale = annonce.annonce_photos.find((p) => p.position === 0)
            const nbPhotos = annonce.annonce_photos.length
            const candidatures = recues.get(annonce.id)

            return (
              <Link
                key={annonce.id}
                href={`/pro/annonces/${annonce.id}`}
                className="card flex gap-lg transition-colors hover:border-hairline-strong"
              >
                <div className="size-24 shrink-0 overflow-hidden rounded-md border border-hairline bg-canvas-soft">
                  {principale ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/annonces/photos/${principale.id}`}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-caption text-mute">
                      Sans photo
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-sm">
                    <Badge ton={TON_STATUT[annonce.statut]}>
                      {annonce.statut === 'cloturee' && annonce.motif_cloture
                        ? `${LIBELLES_STATUT.cloturee} · ${LIBELLES_MOTIF[annonce.motif_cloture]}`
                        : LIBELLES_STATUT[annonce.statut]}
                    </Badge>
                    <span className="text-caption text-mute">Réf. {annonce.reference}</span>
                  </div>

                  <p className="mt-sm text-body-md font-semibold text-ink">
                    {libelleChambres(annonce.chambres) ?? annonce.type}
                    <span className="font-normal text-mute"> · {annonce.type}</span>
                  </p>
                  <p className="text-body-sm text-mute">
                    {annonce.quartier ? `${annonce.quartier}, ` : ''}
                    {annonce.ville}
                  </p>

                  <p className="mt-sm text-body-sm text-body">
                    {annonce.loyer !== null ? `${formaterFCFA(annonce.loyer)}/mois` : 'Loyer à renseigner'}
                    {' · '}
                    {nbPhotos} photo{nbPhotos > 1 ? 's' : ''}
                  </p>
                  <p className="text-caption text-mute">
                    {annonce.statut === 'cloturee'
                      ? `Clôturée le ${formaterDate(annonce.cloturee_le)}`
                      : annonce.disponible_le
                        ? `Disponible le ${formaterDate(annonce.disponible_le)}`
                        : 'Disponible dès maintenant'}
                  </p>

                  {candidatures ? (
                    <p className="mt-sm text-body-sm font-semibold text-ink">
                      {candidatures.total} candidature{candidatures.total > 1 ? 's' : ''}
                      {candidatures.nouvelles > 0 ? (
                        <span className="font-normal text-mute">
                          {' · '}
                          {candidatures.nouvelles} sans réponse
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
