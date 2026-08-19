import type { Metadata } from 'next'
import Link from 'next/link'

import {
  BoutonSouscription,
  FormulaireMotDePasse,
  FormulairePreferences,
  FormulaireProfil,
  FormulaireSignature,
  LienParrainageCopiable,
} from '@/components/app/parametres'
import { Alerte, Badge, EnTetePage } from '@/components/ui/retours'
import { formaterDate, formaterDateCourte, formaterFCFA } from '@/lib/format'
import { abonnementActif, LIMITE_LOGEMENTS_GRATUIT, PRIX_STANDARD_FCFA } from '@/lib/plan'
import { reconcilierRetourGuichet } from '@/lib/reglement-abonnement'
import { bailleurCourant, bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { lienParrainage } from '@/lib/whatsapp'

export const metadata: Metadata = { title: 'Paramètres' }

const ONGLETS = [
  { cle: 'profil', libelle: 'Profil' },
  { cle: 'signature', libelle: 'Signature' },
  { cle: 'preferences', libelle: 'Préférences' },
  { cle: 'parrainage', libelle: 'Parrainage' },
  { cle: 'abonnement', libelle: 'Abonnement' },
] as const

type CleOnglet = (typeof ONGLETS)[number]['cle']

export default async function PageParametres({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; retour?: string }>
}) {
  const bailleurInitial = await bailleurOnboarde()
  const { onglet, retour } = await searchParams

  // Retour du guichet FedaPay. Le webhook est censé avoir crédité l'abonnement,
  // mais il peut s'être perdu : on revérifie la transaction à la source plutôt
  // que d'afficher « en cours » à un bailleur qui a déjà payé.
  //
  // `reglerTransaction` arbitre en base, donc un webhook arrivé entre-temps ne
  // produit pas un second mois offert.
  const etatRetour = retour ? await reconcilierRetourGuichet(bailleurInitial.id) : null

  // Le crédit vient de modifier la ligne : on la relit pour afficher le bon plan.
  const bailleur = etatRetour === 'credite' ? await bailleurCourant() : bailleurInitial

  const actif: CleOnglet = ONGLETS.some((o) => o.cle === onglet)
    ? (onglet as CleOnglet)
    : 'profil'

  const supabase = await creerClientServeur()

  const [{ data: transactions }, { data: recompenses }] = await Promise.all([
    supabase
      .from('abonnements_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(12),
    supabase.from('recompenses_parrainage').select('*').order('attribuee_le', {
      ascending: false,
    }),
  ])

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
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const lienInscription = `${base}/inscription?parrain=${bailleur.code_parrainage}`

  return (
    <div>
      <EnTetePage
        titre="Paramètres"
        description="Votre profil, votre signature et votre abonnement."
      />

      <nav className="mb-xl flex flex-wrap gap-sm">
        {ONGLETS.map((option) => {
          const estActif = option.cle === actif

          return (
            <Link
              key={option.cle}
              href={`/app/parametres?onglet=${option.cle}`}
              aria-current={estActif ? 'page' : undefined}
              className={`rounded-pill px-lg py-sm text-body-sm font-semibold transition-colors ${
                estActif
                  ? 'bg-ink text-on-dark'
                  : 'border border-hairline bg-canvas text-mute hover:text-ink'
              }`}
            >
              {option.libelle}
            </Link>
          )
        })}
      </nav>

      <div className="max-w-[42rem] space-y-xl">
        {actif === 'profil' ? (
          <>
            <FormulaireProfil bailleur={bailleur} />
            <div>
              <h2 className="mb-lg text-display-xs font-semibold text-ink">
                Mot de passe
              </h2>
              <FormulaireMotDePasse />
            </div>
          </>
        ) : null}

        {actif === 'signature' ? (
          <>
            <div className="card-sage">
              <p className="text-body-md font-semibold text-ink-deep">
                Pourquoi une signature ?
              </p>
              <p className="mt-sm text-body-md text-body">
                Elle est incrustée sur chaque quittance PDF. Il s&apos;agit
                d&apos;une signature électronique simple, suffisante entre
                particuliers — pas d&apos;une signature électronique qualifiée.
              </p>
            </div>

            {bailleur.signature_chemin ? (
              <Alerte ton="succes">
                Une signature est enregistrée. Elle apparaît sur vos quittances.
              </Alerte>
            ) : (
              <Alerte ton="attention">
                Aucune signature enregistrée : vos quittances sortent avec un
                cadre de signature vide.
              </Alerte>
            )}

            <FormulaireSignature signatureExistante={Boolean(bailleur.signature_chemin)} />
          </>
        ) : null}

        {actif === 'preferences' ? <FormulairePreferences bailleur={bailleur} /> : null}

        {actif === 'parrainage' ? (
          <>
            <div className="card-sage">
              <p className="text-display-xs font-semibold text-ink-deep">
                Parrainez un bailleur, gagnez 1 mois
              </p>
              <p className="mt-sm text-body-md text-body">
                Vous et votre filleul recevez chacun 1 mois offert dès sa première
                souscription payante.
              </p>
            </div>

            <div className="card card-lg space-y-lg">
              <div>
                <p className="field-label">Votre code de parrainage</p>
                <p className="text-display-sm font-extrabold tracking-tight text-primary">
                  {bailleur.code_parrainage}
                </p>
              </div>

              <div>
                <p className="field-label">Votre lien d&apos;invitation</p>
                <LienParrainageCopiable lien={lienInscription} />
              </div>

              <a
                href={lienParrainage(lienInscription, bailleur.nom)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Partager sur WhatsApp
              </a>
            </div>

            <div>
              <h2 className="mb-lg text-display-xs font-semibold text-ink">
                Vos filleuls
              </h2>
              {(recompenses ?? []).length === 0 ? (
                <p className="rounded-xl bg-canvas-soft p-xl text-body-md text-mute">
                  Aucun filleul n&apos;a encore souscrit. Les mois offerts
                  apparaîtront ici.
                </p>
              ) : (
                <ul className="space-y-sm">
                  {(recompenses ?? []).map((recompense) => (
                    <li
                      key={recompense.id}
                      className="flex items-center justify-between gap-md rounded-lg border border-hairline bg-canvas px-lg py-md"
                    >
                      <span className="text-body-sm text-body">
                        Filleul inscrit · {formaterDateCourte(recompense.attribuee_le)}
                      </span>
                      <Badge ton="positive">
                        +{recompense.mois_offerts} mois offert
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}

        {actif === 'abonnement' ? (
          <>
            {messageRetour ? (
              <Alerte ton={messageRetour.ton}>{messageRetour.texte}</Alerte>
            ) : null}

            <div className={standard ? 'card card-lg' : 'card card-lg'}>
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
                  <li>· Quittances basiques, sans mention du droit de timbre</li>
                  <li>· Relances WhatsApp non disponibles</li>
                </ul>
              )}
            </div>

            <div className="rounded-xl border-t-2 border-t-primary bg-surface-dark p-2xl text-on-dark">
              <p className="text-display-xs font-semibold text-on-dark">
                Plan Standard
              </p>
              <p className="mt-sm text-display-md font-extrabold tracking-tight text-on-dark">
                {formaterFCFA(PRIX_STANDARD_FCFA)}
                <span className="text-body-md font-normal text-on-dark-mute"> /mois</span>
              </p>

              <ul className="mt-xl space-y-sm text-body-md text-on-dark">
                <li>· Logements illimités</li>
                <li>· Quittances conformes Bénin (droit de timbre)</li>
                <li>· Relances WhatsApp des impayés</li>
                <li>· Historique complet</li>
                <li>· Support par email</li>
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
                <div className="overflow-x-auto rounded-xl border border-hairline">
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
                          <td className="font-mono text-caption">
                            {transaction.transaction_id}
                          </td>
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
          </>
        ) : null}
      </div>
    </div>
  )
}
