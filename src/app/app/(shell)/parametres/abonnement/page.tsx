import type { Metadata } from 'next'

import { EnteteParametre } from '@/components/app/entete-parametre'
import { BoutonSouscription } from '@/components/app/parametres'
import { Alerte, Badge } from '@/components/ui/retours'
import { formaterDate, formaterDateCourte, formaterFCFA } from '@/lib/format'
import { abonnementActif, LIMITE_LOGEMENTS_GRATUIT, PRIX_STANDARD_FCFA } from '@/lib/plan'
import { reconcilierRetourGuichet } from '@/lib/reglement-abonnement'
import { bailleurCourant, bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Paramètres · Abonnement' }

export default async function PageAbonnement({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string }>
}) {
  const [bailleurInitial, { retour }] = await Promise.all([bailleurOnboarde(), searchParams])

  // Retour du guichet FedaPay. Le webhook est censé avoir crédité l'abonnement,
  // mais il peut s'être perdu : on revérifie la transaction à la source plutôt
  // que d'afficher « en cours » à un bailleur qui a déjà payé.
  //
  // `reglerTransaction` arbitre en base, donc un webhook arrivé entre-temps ne
  // produit pas un second mois offert.
  const etatRetour = retour ? await reconcilierRetourGuichet(bailleurInitial.id) : null

  // Le crédit vient de modifier la ligne : on la relit pour afficher le bon plan.
  const bailleur = etatRetour === 'credite' ? await bailleurCourant() : bailleurInitial

  const supabase = await creerClientServeur()
  const { data: transactions } = await supabase
    .from('abonnements_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(12)

  const standard = abonnementActif(bailleur)

  // Un retour de guichet sans message clair est la pire des situations : le
  // bailleur vient de payer et ne sait pas si son argent est arrivé.
  const messageRetour = !etatRetour
    ? null
    : etatRetour === 'credite' || (etatRetour === 'deja_regle' && standard)
      ? {
          ton: 'succes' as const,
          texte:
            'Paiement confirmé. Votre plan Standard est actif' +
            (bailleur.date_fin_abonnement
              ? ` jusqu'au ${formaterDate(bailleur.date_fin_abonnement)}.`
              : '.'),
        }
      : etatRetour === 'echec'
        ? {
            ton: 'attention' as const,
            texte:
              "Le paiement n'a pas abouti. Aucun montant n'a été prélevé — vous " +
              'pouvez relancer la souscription ci-dessous.',
          }
        : etatRetour === 'indisponible'
          ? {
              ton: 'info' as const,
              texte:
                "Nous n'avons pas pu joindre l'opérateur à l'instant. Si votre " +
                'paiement est passé, votre plan sera mis à jour automatiquement ' +
                'dès sa confirmation.',
            }
          : {
              ton: 'info' as const,
              texte:
                'Paiement en cours de vérification. Votre plan sera mis à jour dès ' +
                "confirmation par l'opérateur Mobile Money — cela prend " +
                "généralement moins d'une minute.",
            }

  return (
    <div className="max-w-[46rem]">
      <EnteteParametre cle="abonnement" />

      <div className="space-y-xl">
        {messageRetour ? (
          <Alerte ton={messageRetour.ton}>{messageRetour.texte}</Alerte>
        ) : null}

        <div className="card card-lg">
          <div className="flex flex-wrap items-start justify-between gap-md">
            <div>
              <p className="text-body-sm text-mute">Votre plan actuel</p>
              <p className="mt-xxs text-display-sm font-semibold text-ink">
                {standard ? 'Standard' : 'Gratuit'}
              </p>
            </div>
            <Badge ton={standard ? 'positive' : 'neutral'}>
              {standard ? 'Actif' : 'Sans engagement'}
            </Badge>
          </div>

          {standard && bailleur.date_fin_abonnement ? (
            <p className="mt-lg text-body-md text-body">
              Votre abonnement court jusqu&apos;au{' '}
              <strong className="font-semibold">
                {formaterDate(bailleur.date_fin_abonnement)}
              </strong>
              .
            </p>
          ) : (
            <ul className="mt-lg space-y-sm text-body-md text-body">
              <li>· Jusqu&apos;à {LIMITE_LOGEMENTS_GRATUIT} logements</li>
              <li>· Quittances complètes, mention du droit de timbre comprise</li>
              <li>· Relances WhatsApp non disponibles</li>
            </ul>
          )}
        </div>

        <div className="rounded-xl border-t-2 border-t-primary bg-surface-dark p-2xl text-on-dark">
          <p className="text-display-xs font-semibold text-on-dark">Plan Standard</p>
          <p className="mt-sm text-display-md font-extrabold tracking-tight text-on-dark">
            {formaterFCFA(PRIX_STANDARD_FCFA)}
            <span className="text-body-md font-normal text-on-dark-mute"> /mois</span>
          </p>

          <ul className="mt-xl space-y-sm text-body-md text-on-dark">
            <li>· Logements illimités</li>
            <li>· Relances WhatsApp des impayés</li>
            <li>· Quittances complètes, mention du droit de timbre comprise</li>
          </ul>

          <div className="mt-xl">
            <BoutonSouscription />
          </div>

          <p className="mt-md text-caption text-on-dark-mute">
            Paiement par Mobile Money via FedaPay. Sans engagement :{' '}
            {standard ? 'chaque paiement prolonge d’un mois.' : 'arrêtez quand vous voulez.'}
          </p>
        </div>

        <div>
          <h2 className="mb-lg text-display-xs font-semibold text-ink">
            Historique de facturation
          </h2>
          {(transactions ?? []).length === 0 ? (
            <p className="rounded-xl bg-canvas-soft p-xl text-body-md text-mute">
              Aucune transaction pour le moment.
            </p>
          ) : (
            <div className="table-defilante">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Référence</th>
                    <th scope="col">Statut</th>
                    <th scope="col" className="text-right">
                      Montant
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(transactions ?? []).map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{formaterDateCourte(transaction.created_at.slice(0, 10))}</td>
                      <td className="font-mono text-caption">{transaction.transaction_id}</td>
                      <td>
                        <Badge
                          ton={
                            transaction.statut === 'REGLEE'
                              ? 'positive'
                              : transaction.statut === 'EN_ATTENTE'
                                ? 'warning'
                                : 'negative'
                          }
                        >
                          {transaction.statut === 'REGLEE'
                            ? 'Réglée'
                            : transaction.statut === 'EN_ATTENTE'
                              ? 'En attente'
                              : transaction.statut}
                        </Badge>
                      </td>
                      <td className="text-right font-semibold tabular">
                        {formaterFCFA(transaction.montant)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
