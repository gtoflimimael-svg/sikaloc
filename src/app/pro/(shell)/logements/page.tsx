import type { Metadata } from 'next'
import Link from 'next/link'

import { ResumeListe } from '@/components/ui/listes'
import { Illustration } from '@/components/ui/illustration'
import { ActionConfirmee } from '@/components/ui/action-confirmee'
import { Alerte, Badge, EnTetePage, EtatVide } from '@/components/ui/retours'
import { supprimerLogement } from '@/lib/actions/logements'
import { formaterFCFA } from '@/lib/format'
import { capacites } from '@/lib/plan'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Logements' }

export default async function PageLogements() {
  const supabase = await creerClientServeur()

  // La liste des logements est scopée par les RLS (cookie de session), pas
  // par l'objet `bailleur` — celui-ci ne sert plus bas que pour son plafond de
  // plan. Les deux lectures partent donc en parallèle.
  const [bailleur, { data: logements, error: erreurLogements }] = await Promise.all([
    bailleurOnboarde(),
    supabase
      .from('logements')
      .select('*, baux(id, statut, loyer_mensuel, locataire:locataires(nom)), annonces(id, statut)')
      .order('created_at', { ascending: false }),
  ])

  const liste = logements ?? []
  const limite = capacites(bailleur).maxLogements
  const plafondAtteint = limite !== null && liste.length >= limite

  return (
    <div>
      <EnTetePage
        titre="Logements"
        description="Les biens que vous mettez en location."
        action={
          plafondAtteint ? (
            <Link href="/pro/parametres/abonnement" className="btn btn-primary">
              Passer au plan Standard
            </Link>
          ) : (
            <Link href="/pro/logements/nouveau" className="btn btn-primary">
              Nouveau logement
            </Link>
          )
        }
      />

      {plafondAtteint ? (
        <div className="mb-xl">
          <Alerte ton="attention">
            Vous avez atteint la limite de {limite} logements du plan Gratuit.
            Passez au plan Standard pour en enregistrer autant que vous le
            souhaitez.
          </Alerte>
        </div>
      ) : null}

      {erreurLogements ? (
        <Alerte ton="erreur">Les logements ne peuvent pas être chargés. Actualisez la page pour réessayer.</Alerte>
      ) : liste.length === 0 ? (
        <EtatVide
          icone={<Illustration nom="plante" taille={200} decorative />}
          titre="Aucun logement enregistré"
          description="Ajoutez un logement, puis créez le bail qui le rattache à un locataire."
          action={
            <Link href="/pro/logements/nouveau" className="btn btn-primary">
              Ajouter un logement
            </Link>
          }
        />
      ) : (
        <>
        <ResumeListe>{liste.length} logement{liste.length > 1 ? 's' : ''} enregistré{liste.length > 1 ? 's' : ''}</ResumeListe>
        <ul className="grid gap-md lg:grid-cols-2" aria-label="Logements enregistrés">
          {liste.map((logement) => {
            const baux = (logement.baux ?? []) as unknown as {
              id: string
              statut: string
              loyer_mensuel: number
              locataire?: { nom?: string } | { nom?: string }[]
            }[]

            const bailActif = baux.find((b) => b.statut === 'Actif')
            // Au plus une annonce vivante par logement (index unique de S1).
            const annonceVivante = (
              (logement.annonces ?? []) as unknown as { id: string; statut: string }[]
            ).find((a) => a.statut !== 'cloturee')
            const locataire = Array.isArray(bailActif?.locataire)
              ? bailActif?.locataire[0]
              : bailActif?.locataire

            return (
              <li key={logement.id} className="card list-card flex flex-col" aria-labelledby={`logement-${logement.id}`}>
                <div className="flex items-start justify-between gap-md">
                  <div className="min-w-0">
                    <h2 id={`logement-${logement.id}`} className="list-title">{logement.adresse}</h2>
                    <p className="mt-xxs text-body-sm text-mute">
                      {logement.ville}, {logement.pays}
                    </p>
                  </div>
                  <Badge ton="neutral">{logement.type}</Badge>
                </div>

                <div className="mt-md flex flex-wrap items-start justify-between gap-xs border-t border-hairline-soft pt-md">
                  {bailActif ? (
                    <>
                    <p className="list-copy text-body-sm text-body">
                      Loué à{' '}
                      <span className="font-semibold text-ink">
                        {locataire?.nom ?? 'locataire'}
                      </span>
                    </p>
                    <p className="money text-body-md font-semibold text-ink">{formaterFCFA(bailActif.loyer_mensuel)}<span className="text-caption font-normal text-mute"> /mois</span></p>
                    </>
                  ) : (
                    <p className="text-body-sm text-mute">Aucun bail actif — logement libre.</p>
                  )}
                </div>

                <div className="list-actions mt-auto">
                  <Link
                    href={`/pro/logements/${logement.id}/modifier`}
                    aria-label={`Modifier le logement ${logement.adresse}`}
                    className="btn btn-tertiary btn-sm"
                  >
                    Modifier
                  </Link>
                  {!bailActif ? (
                    <Link href="/pro/baux/nouveau" className="btn btn-secondary btn-sm">
                      Créer un bail
                    </Link>
                  ) : null}
                  {annonceVivante ? (
                    <Link
                      href={`/pro/annonces/${annonceVivante.id}`}
                      className="btn btn-tertiary btn-sm"
                    >
                      Voir l’annonce
                    </Link>
                  ) : (
                    <Link
                      href={`/pro/annonces/nouvelle?logement=${logement.id}`}
                      className="btn btn-tertiary btn-sm"
                    >
                      Mettre en location
                    </Link>
                  )}
                  <ActionConfirmee
                    action={supprimerLogement.bind(null, logement.id)}
                    libelle="Supprimer"
                    varianteDeclencheur="tertiary"
                    titreConfirmation="Supprimer ce logement ?"
                    messageConfirmation="Cette action est définitive. Elle échouera si un bail ou une annonce en cours y est rattaché."
                    libelleConfirmation="Supprimer définitivement"
                  />
                </div>
              </li>
            )
          })}
        </ul>
        </>
      )}
    </div>
  )
}
