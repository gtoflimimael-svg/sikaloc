import type { Metadata } from 'next'
import Link from 'next/link'

import { IllustrationMarque } from '@/components/ui/illustration-marque'
import { Alerte, Badge, EnTetePage, EtatVide } from '@/components/ui/retours'
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
  const [, reponseAnnonces, reponseCompteurs] = await Promise.all([
    bailleurOnboarde(),
    supabase
      .from('annonces')
      .select(
        'id, reference, statut, motif_cloture, type, ville, quartier, chambres, loyer, disponible_le, cloturee_le, annonce_photos(id, position)',
      )
      .order('created_at', { ascending: false }),
    supabase.rpc('candidatures_par_annonce'),
  ])
  const { data, error: erreurAnnonces } = reponseAnnonces
  const { data: compteurs, error: erreurCompteurs } = reponseCompteurs

  const annonces = ((data ?? []) as unknown as LigneAnnonce[]).sort(
    (a, b) => RANG[a.statut] - RANG[b.statut],
  )

  // Une annonce absente du décompte n'a reçu aucune candidature.
  const recues = new Map<string, CompteurCandidatures>(
    ((compteurs ?? []) as CompteurCandidatures[]).map((c) => [c.annonce_id, c]),
  )

  return (
    <div className="listings-page">
      <EnTetePage
        titre="Annonces"
        description="Vos logements mis en location sur Sikaloc_Find."
        action={
          <Link href="/pro/annonces/nouvelle" className="btn btn-primary">
            Créer une annonce
          </Link>
        }
      />

      {erreurCompteurs ? (
        <Alerte ton="attention">
          Les candidatures par annonce n’ont pas pu être comptées ; la liste des annonces reste consultable.
        </Alerte>
      ) : null}

      {erreurAnnonces ? (
        <Alerte ton="erreur">
          Les annonces n’ont pas pu être chargées. Actualisez la page pour réessayer.
        </Alerte>
      ) : annonces.length === 0 ? (
        <EtatVide
          icone={<IllustrationMarque variante="recherche" />}
          titre="Aucune annonce"
          description="Un logement libre, ou qui le sera bientôt, peut être proposé à la location : préparez son annonce, ajoutez des photos, puis publiez-la."
          action={
            <Link href="/pro/annonces/nouvelle" className="btn btn-primary">
              Créer une annonce
            </Link>
          }
        />
      ) : (
        <div className="listing-management-grid">
          {annonces.map((annonce) => {
            const principale = annonce.annonce_photos.find((p) => p.position === 0)
            const nbPhotos = annonce.annonce_photos.length
            const candidatures = recues.get(annonce.id)

            return (
              <Link
                key={annonce.id}
                href={`/pro/annonces/${annonce.id}`}
                className="card listing-management-card"
              >
                <div className="listing-management-photo">
                  {principale ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/annonces/photos/${principale.id}`}
                      alt=""
                      loading="lazy"
                      className="listing-management-image"
                    />
                  ) : (
                    <span className="listing-management-no-photo text-caption text-mute">
                      Sans photo
                    </span>
                  )}
                </div>

                <div className="listing-management-content">
                  <div className="listing-management-meta">
                    <Badge ton={TON_STATUT[annonce.statut]}>
                      {annonce.statut === 'cloturee' && annonce.motif_cloture
                        ? `${LIBELLES_STATUT.cloturee} · ${LIBELLES_MOTIF[annonce.motif_cloture]}`
                        : LIBELLES_STATUT[annonce.statut]}
                    </Badge>
                    <span className="text-caption text-mute">Réf. {annonce.reference}</span>
                  </div>

                  <h2 className="listing-management-title">
                    {libelleChambres(annonce.chambres) ?? annonce.type}
                    <span className="font-normal text-mute"> · {annonce.type}</span>
                  </h2>
                  <p className="listing-management-location text-body-sm text-mute">
                    {annonce.quartier ? `${annonce.quartier}, ` : ''}
                    {annonce.ville}
                  </p>

                  <dl className="listing-management-facts">
                    <div>
                      <dt>Loyer mensuel</dt>
                      <dd className="money">
                        {annonce.loyer !== null ? formaterFCFA(annonce.loyer) : 'À renseigner'}
                      </dd>
                    </div>
                    <div>
                      <dt>Disponibilité</dt>
                      <dd>
                        {annonce.statut === 'cloturee'
                          ? `Clôturée le ${formaterDate(annonce.cloturee_le)}`
                          : annonce.disponible_le
                            ? formaterDate(annonce.disponible_le)
                            : 'Dès maintenant'}
                      </dd>
                    </div>
                    <div>
                      <dt>Photos</dt>
                      <dd>{nbPhotos}</dd>
                    </div>
                    {candidatures ? (
                      <div>
                        <dt>Candidatures</dt>
                        <dd>
                          {candidatures.total}
                          {candidatures.nouvelles > 0 ? ` · ${candidatures.nouvelles} sans réponse` : ''}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  <span className="listing-management-open">
                    Gérer l’annonce <span aria-hidden="true">↗</span>
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
