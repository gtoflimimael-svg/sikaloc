import type { Metadata } from 'next'
import Link from 'next/link'

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
  const [bailleur, { data: logements }] = await Promise.all([
    bailleurOnboarde(),
    supabase
      .from('logements')
      .select('*, baux(id, statut, loyer_mensuel, locataire:locataires(nom))')
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
            <Link href="/app/parametres/abonnement" className="btn btn-primary">
              Passer au plan Standard
            </Link>
          ) : (
            <Link href="/app/logements/nouveau" className="btn btn-primary">
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

      {liste.length === 0 ? (
        <EtatVide
          icone={<Illustration nom="plante" taille={200} decorative />}
          titre="Aucun logement enregistré"
          description="Ajoutez un logement, puis créez le bail qui le rattache à un locataire."
          action={
            <Link href="/app/logements/nouveau" className="btn btn-primary">
              Ajouter un logement
            </Link>
          }
        />
      ) : (
        <div className="grid gap-md md:grid-cols-2">
          {liste.map((logement) => {
            const baux = (logement.baux ?? []) as unknown as {
              id: string
              statut: string
              loyer_mensuel: number
              locataire?: { nom?: string } | { nom?: string }[]
            }[]

            const bailActif = baux.find((b) => b.statut === 'Actif')
            const locataire = Array.isArray(bailActif?.locataire)
              ? bailActif?.locataire[0]
              : bailActif?.locataire

            return (
              <div key={logement.id} className="card flex flex-col">
                <div className="flex items-start justify-between gap-md">
                  <div className="min-w-0">
                    <p className="text-body-md font-semibold text-ink">{logement.adresse}</p>
                    <p className="mt-xxs text-body-sm text-mute">
                      {logement.ville}, {logement.pays}
                    </p>
                  </div>
                  <Badge ton="neutral">{logement.type}</Badge>
                </div>

                <div className="mt-lg border-t border-hairline-soft pt-lg">
                  {bailActif ? (
                    <p className="text-body-sm text-body">
                      Loué à{' '}
                      <span className="font-semibold text-ink">
                        {locataire?.nom ?? 'locataire'}
                      </span>{' '}
                      · {formaterFCFA(bailActif.loyer_mensuel)}/mois
                    </p>
                  ) : (
                    <p className="text-body-sm text-mute">Aucun bail actif — logement libre.</p>
                  )}
                </div>

                <div className="mt-lg flex flex-wrap items-center gap-sm">
                  <Link
                    href={`/app/logements/${logement.id}/modifier`}
                    className="btn btn-tertiary btn-sm"
                  >
                    Modifier
                  </Link>
                  {!bailActif ? (
                    <Link href="/app/baux/nouveau" className="btn btn-secondary btn-sm">
                      Créer un bail
                    </Link>
                  ) : null}
                  <ActionConfirmee
                    action={supprimerLogement.bind(null, logement.id)}
                    libelle="Supprimer"
                    varianteDeclencheur="tertiary"
                    titreConfirmation="Supprimer ce logement ?"
                    messageConfirmation="Cette action est définitive. Elle échouera si un bail y est rattaché."
                    libelleConfirmation="Supprimer définitivement"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
