import type { Metadata } from 'next'
import Link from 'next/link'

import { Illustration } from '@/components/ui/illustration'
import { AvatarPeep } from '@/components/ui/avatar-peep'
import { ActionConfirmee } from '@/components/ui/action-confirmee'
import { Badge, EnTetePage, EtatVide } from '@/components/ui/retours'
import { supprimerLocataire } from '@/lib/actions/locataires'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { bailleurOnboarde } from '@/lib/session'

export const metadata: Metadata = { title: 'Locataires' }

export default async function PageLocataires() {
  const supabase = await creerClientServeur()

  // Le résultat de `bailleurOnboarde()` n'est même pas utilisé ici : il ne
  // sert qu'à vérifier l'accès, ce que les RLS vérifient de toute façon sur la
  // requête elle-même. Les deux partent donc en parallèle plutôt qu'à la suite.
  const [, { data: locataires }] = await Promise.all([
    bailleurOnboarde(),
    supabase.from('locataires').select('*, baux(id, statut)').order('nom', { ascending: true }),
  ])

  const liste = locataires ?? []

  return (
    <div>
      <EnTetePage
        titre="Locataires"
        description="Les personnes à qui vous louez. Elles n’ont aucun compte à créer."
        action={
          <Link href="/app/locataires/nouveau" className="btn btn-primary">
            Nouveau locataire
          </Link>
        }
      />

      {liste.length === 0 ? (
        <EtatVide
          icone={<Illustration nom="attente" taille={200} decorative />}
          titre="Aucun locataire enregistré"
          description="Ajoutez un locataire, puis rattachez-lui un bail pour commencer à suivre ses loyers."
          action={
            <Link href="/app/locataires/nouveau" className="btn btn-primary">
              Ajouter un locataire
            </Link>
          }
        />
      ) : (
        <div className="space-y-md">
          {liste.map((locataire) => {
            const baux = (locataire.baux ?? []) as unknown as { id: string; statut: string }[]
            const actifs = baux.filter((b) => b.statut === 'Actif').length

            return (
              <div key={locataire.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-lg">
                  <div className="flex min-w-0 items-center gap-lg">
                    <AvatarPeep id={locataire.id} avatar={locataire.avatar} nom={locataire.nom} />
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold text-ink">
                        {locataire.nom}
                      </p>
                      <p className="truncate text-body-sm text-mute">
                        {locataire.telephone}
                        {locataire.email ? ` · ${locataire.email}` : ''}
                      </p>
                      <div className="mt-sm">
                        {actifs > 0 ? (
                          <Badge ton="neutral">
                            {actifs} bail{actifs > 1 ? 'x' : ''} actif{actifs > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge ton="neutral">Aucun bail actif</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-sm">
                    <Link
                      href={`/app/locataires/${locataire.id}/modifier`}
                      className="btn btn-tertiary btn-sm"
                    >
                      Modifier
                    </Link>
                    <ActionConfirmee
                      action={supprimerLocataire.bind(null, locataire.id)}
                      libelle="Supprimer"
                      varianteDeclencheur="tertiary"
                      titreConfirmation={`Supprimer ${locataire.nom} ?`}
                      messageConfirmation="Cette action est définitive. Elle échouera si le locataire est rattaché à un bail — c'est la protection de vos historiques de paiement."
                      libelleConfirmation="Supprimer définitivement"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
