import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FormulaireAnnonce } from '@/components/app/formulaire-annonce'
import { PhotosAnnonce, type PhotoGeree } from '@/components/app/photos-annonce'
import { ActionConfirmee } from '@/components/ui/action-confirmee'
import { Alerte, Badge, EnTetePage } from '@/components/ui/retours'
import {
  cloturerAnnonce,
  enregistrerAnnonce,
  publierAnnonce,
  reprendreAnnonce,
  supprimerAnnonceBrouillon,
  suspendreAnnonce,
} from '@/lib/actions/annonces'
import {
  LIBELLES_EQUIPEMENT,
  LIBELLES_MOTIF,
  LIBELLES_STATUT,
  TON_STATUT,
  libelleChambres,
} from '@/lib/annonces/libelles'
import { formaterDate, formaterFCFA } from '@/lib/format'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Annonce' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Une annonce, vue par son bailleur.
 *
 * `[id]` est l'identifiant INTERNE : il ne sert qu'ici, dans l'espace Pro. La
 * vitrine publique ne connaîtra que la référence.
 *
 * Une annonce d'un autre bailleur est introuvable pour la session : la page
 * répond 404, comme pour un identifiant qui n'existe pas.
 */
export default async function PageAnnonce({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ existante?: string }>
}) {
  const [{ id }, { existante }] = await Promise.all([params, searchParams])
  if (!UUID.test(id)) notFound()

  const supabase = await creerClientServeur()
  const [, { data: annonce }, { data: photos }] = await Promise.all([
    bailleurOnboarde(),
    supabase.from('annonces').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('annonce_photos')
      .select('id, position, largeur, hauteur')
      .eq('annonce_id', id)
      .order('position'),
  ])
  if (!annonce) notFound()

  const { data: logement } = annonce.logement_id
    ? await supabase.from('logements').select('adresse, ville').eq('id', annonce.logement_id).maybeSingle()
    : { data: null }

  const listePhotos = (photos ?? []) as PhotoGeree[]
  const cloturee = annonce.statut === 'cloturee'
  const titre = `${libelleChambres(annonce.chambres) ?? annonce.type}${annonce.quartier ? ` · ${annonce.quartier}` : ''}`

  const confirmationPublication =
    'Elle rejoindra le catalogue public de Sikaloc_Find : type, ville, quartier, prix, équipements, description, disponibilité et photos. L’adresse exacte, votre téléphone et votre email ne sont jamais publiés.'

  return (
    <div className="mx-auto max-w-[56rem] space-y-xl">
      <div>
        <Link href="/pro/annonces" className="text-body-sm text-mute hover:text-ink">
          ← Annonces
        </Link>
      </div>

      <EnTetePage
        titre={titre}
        description={`${annonce.type} · ${annonce.ville} · Réf. ${annonce.reference}`}
        action={
          <Badge ton={TON_STATUT[annonce.statut]}>
            {cloturee && annonce.motif_cloture
              ? `${LIBELLES_STATUT.cloturee} · ${LIBELLES_MOTIF[annonce.motif_cloture]}`
              : LIBELLES_STATUT[annonce.statut]}
          </Badge>
        }
      />

      {existante ? (
        <Alerte ton="info">Ce logement avait déjà une annonce en cours : la voici.</Alerte>
      ) : null}

      {annonce.statut === 'brouillon' ? (
        <Alerte ton="info">
          Brouillon : cette annonce n’est visible par personne. Complétez-la, ajoutez au moins une
          photo, puis publiez-la.
        </Alerte>
      ) : null}
      {annonce.statut === 'publiee' ? (
        <Alerte ton="succes">
          Publiée le {formaterDate(annonce.publiee_le)} : elle figure dans le catalogue public de
          Sikaloc_Find, où chacun peut la consulter et candidater.
        </Alerte>
      ) : null}
      {annonce.statut === 'suspendue' ? (
        <Alerte ton="attention">
          Suspendue : elle n’est plus visible dans Sikaloc_Find. Ses photos, ses informations et sa
          référence sont conservées ; reprenez la publication quand vous le souhaitez.
        </Alerte>
      ) : null}
      {cloturee ? (
        <Alerte ton="info">
          Clôturée le {formaterDate(annonce.cloturee_le)}. Elle n’est plus visible et ne se rouvre
          pas. Pour remettre ce logement en location, créez une nouvelle annonce.
        </Alerte>
      ) : null}

      {annonce.statut !== 'brouillon' ? (
        <section className="card flex flex-wrap items-center justify-between gap-md">
          <div>
            <p className="text-body-md font-semibold text-ink">Candidatures reçues</p>
            <p className="text-body-sm text-mute">
              Le nom et le message de chaque candidat. Ni téléphone, ni email.
            </p>
          </div>
          <Link href={`/pro/annonces/${annonce.id}/candidatures`} className="btn btn-secondary">
            Voir les candidatures
          </Link>
        </section>
      ) : null}

      <section className="card space-y-md">
        <p className="text-body-sm text-mute">
          Logement :{' '}
          <span className="text-ink">
            {logement ? `${logement.adresse}, ${logement.ville}` : 'supprimé depuis la clôture'}
          </span>
        </p>

        {annonce.statut === 'brouillon' ? (
          <div className="flex flex-wrap items-start gap-md">
            <ActionConfirmee
              action={publierAnnonce.bind(null, annonce.id)}
              libelle="Publier l’annonce"
              variante="primary"
              compact={false}
              titreConfirmation="Publier cette annonce ?"
              messageConfirmation={confirmationPublication}
              libelleConfirmation="Publier"
            />
            <ActionConfirmee
              action={supprimerAnnonceBrouillon.bind(null, annonce.id)}
              libelle="Supprimer le brouillon"
              varianteDeclencheur="tertiary"
              compact={false}
              titreConfirmation="Supprimer ce brouillon ?"
              messageConfirmation="Le brouillon et ses photos seront supprimés définitivement."
              libelleConfirmation="Supprimer"
            />
          </div>
        ) : null}

        {annonce.statut === 'publiee' ? (
          <div className="flex flex-wrap items-start gap-md">
            <ActionConfirmee
              action={suspendreAnnonce.bind(null, annonce.id)}
              libelle="Suspendre"
              variante="secondary"
              compact={false}
              titreConfirmation="Suspendre cette annonce ?"
              messageConfirmation="Elle disparaîtra de Sikaloc_Find. Vous pourrez la reprendre plus tard, telle quelle."
              libelleConfirmation="Suspendre"
            />
          </div>
        ) : null}

        {annonce.statut === 'suspendue' ? (
          <div className="flex flex-wrap items-start gap-md">
            <ActionConfirmee
              action={reprendreAnnonce.bind(null, annonce.id)}
              libelle="Reprendre la publication"
              variante="primary"
              compact={false}
              titreConfirmation="Republier cette annonce ?"
              messageConfirmation={confirmationPublication}
              libelleConfirmation="Republier"
            />
          </div>
        ) : null}

        {annonce.statut === 'publiee' || annonce.statut === 'suspendue' ? (
          <div className="flex flex-wrap items-start gap-md border-t border-hairline-soft pt-md">
            <ActionConfirmee
              action={cloturerAnnonce.bind(null, annonce.id, 'louee_ailleurs')}
              libelle="Clôturer : logement loué"
              varianteDeclencheur="tertiary"
              compact={false}
              titreConfirmation="Le logement est loué ?"
              messageConfirmation="L’annonce sera clôturée définitivement. Elle ne se rouvre pas : une future mise en location passera par une nouvelle annonce."
              libelleConfirmation="Clôturer"
              variante="secondary"
            />
            <ActionConfirmee
              action={cloturerAnnonce.bind(null, annonce.id, 'retiree')}
              libelle="Clôturer : retirer l’annonce"
              varianteDeclencheur="tertiary"
              compact={false}
              titreConfirmation="Retirer cette annonce ?"
              messageConfirmation="L’annonce sera clôturée définitivement. Pour une pause, préférez « Suspendre »."
              libelleConfirmation="Retirer"
              variante="secondary"
            />
          </div>
        ) : null}
      </section>

      <PhotosAnnonce
        annonceId={annonce.id}
        photos={listePhotos}
        modifiable={!cloturee}
        publiee={annonce.statut === 'publiee'}
      />

      {cloturee ? (
        <section className="card card-lg">
          <dl className="grid gap-md text-body-sm sm:grid-cols-2">
            <div>
              <dt className="text-mute">Loyer</dt>
              <dd className="text-ink">{annonce.loyer !== null ? formaterFCFA(annonce.loyer) : '—'}</dd>
            </div>
            <div>
              <dt className="text-mute">Équipements</dt>
              <dd className="text-ink">
                {annonce.equipements.length
                  ? annonce.equipements.map((e) => LIBELLES_EQUIPEMENT[e]).join(', ')
                  : '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-mute">Description</dt>
              <dd className="whitespace-pre-line text-ink">{annonce.description ?? '—'}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <FormulaireAnnonce action={enregistrerAnnonce.bind(null, annonce.id)} annonce={annonce} />
      )}
    </div>
  )
}
