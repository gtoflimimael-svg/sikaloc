import type { Metadata } from 'next'
import Link from 'next/link'

import { ResumeListe } from '@/components/ui/listes'
import { BoutonInvitation } from '@/components/app/bouton-invitation'
import { Illustration } from '@/components/ui/illustration'
import { AvatarPeep } from '@/components/ui/avatar-peep'
import { ActionConfirmee } from '@/components/ui/action-confirmee'
import { Alerte, Badge, EnTetePage, EtatVide } from '@/components/ui/retours'
import { supprimerLocataire } from '@/lib/actions/locataires'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { bailleurOnboarde } from '@/lib/session'
import { formaterTelephone } from '@/lib/telephone'

export const metadata: Metadata = { title: 'Locataires' }

export default async function PageLocataires() {
  const supabase = await creerClientServeur()

  // Le résultat de `bailleurOnboarde()` n'est même pas utilisé ici : il ne
  // sert qu'à vérifier l'accès, ce que les RLS vérifient de toute façon sur la
  // requête elle-même. Les deux partent donc en parallèle plutôt qu'à la suite.
  const [, { data: locataires, error: erreurLocataires }] = await Promise.all([
    bailleurOnboarde(),
    supabase.from('locataires').select('*, baux(id, statut)').order('nom', { ascending: true }),
  ])

  const liste = locataires ?? []

  // Les invitations encore en attente, pour distinguer « inviter » de
  // « renvoyer ». Une requête pour toute la liste plutôt qu'une par ligne.
  const { data: invitations, error: erreurInvitations } = await supabase
    .from('invitations_locataire')
    .select('locataire_id')
    .is('utilisee_le', null)
    .is('annulee_le', null)
    .gt('expire_le', new Date().toISOString())

  const enAttente = new Set((invitations ?? []).map((i) => i.locataire_id))

  return (
    <div>
      <EnTetePage
        titre="Locataires"
        description="Les personnes à qui vous louez. Invitez-les sur Sikaloc_Me pour qu’elles suivent leurs loyers et leurs quittances."
        action={
          <Link href="/pro/locataires/nouveau" className="btn btn-primary">
            Nouveau locataire
          </Link>
        }
      />

      {erreurInvitations ? <div className="mb-lg"><Alerte ton="attention">Le statut des invitations ne peut pas être chargé. Les informations d’invitation peuvent être incomplètes.</Alerte></div> : null}

      {erreurLocataires ? (
        <Alerte ton="erreur">Les locataires ne peuvent pas être chargés. Actualisez la page pour réessayer.</Alerte>
      ) : liste.length === 0 ? (
        <EtatVide
          icone={<Illustration nom="attente" taille={200} decorative />}
          titre="Aucun locataire enregistré"
          description="Ajoutez un locataire, puis rattachez-lui un bail pour commencer à suivre ses loyers."
          action={
            <Link href="/pro/locataires/nouveau" className="btn btn-primary">
              Ajouter un locataire
            </Link>
          }
        />
      ) : (
        <>
        <ResumeListe>{liste.length} locataire{liste.length > 1 ? 's' : ''} enregistré{liste.length > 1 ? 's' : ''}</ResumeListe>
        <ul className="space-y-sm" aria-label="Locataires enregistrés">
          {liste.map((locataire) => {
            const baux = (locataire.baux ?? []) as unknown as { id: string; statut: string }[]
            const actifs = baux.filter((b) => b.statut === 'Actif').length

            return (
              <li key={locataire.id} className="card list-card" aria-labelledby={`locataire-${locataire.id}`}>
                <div className="list-row">
                  <div className="flex min-w-0 items-start gap-sm">
                    <AvatarPeep id={locataire.id} avatar={locataire.avatar} nom={locataire.nom} />
                    <div className="min-w-0">
                      <h2 id={`locataire-${locataire.id}`} className="list-title">
                        {locataire.nom}
                      </h2>
                      <p className="list-copy text-body-sm text-mute">
                        {formaterTelephone(locataire.telephone)}
                        {locataire.email ? <span className="block">{locataire.email}</span> : null}
                      </p>
                      <div className="mt-sm">
                        {actifs > 0 ? (
                          <Badge ton="neutral">
                            {actifs} {actifs > 1 ? 'baux' : 'bail'} actif{actifs > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge ton="neutral">Aucun bail actif</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="list-actions">
                    <BoutonInvitation
                      locataireId={locataire.id}
                      nom={locataire.nom}
                      email={locataire.email}
                      rattache={Boolean(locataire.compte_id)}
                      invitationEnAttente={enAttente.has(locataire.id)}
                    />
                    <Link
                      href={`/pro/locataires/${locataire.id}/modifier`}
                      aria-label={`Modifier le locataire ${locataire.nom}`}
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
              </li>
            )
          })}
        </ul>
        </>
      )}
    </div>
  )
}
