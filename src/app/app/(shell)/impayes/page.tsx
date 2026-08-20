import type { Metadata } from 'next'
import Link from 'next/link'

import { AvatarPeep } from '@/components/ui/avatar-peep'
import { Alerte, Badge, EnTetePage } from '@/components/ui/retours'
import { formaterDate, formaterFCFA, formaterPeriode } from '@/lib/format'
import { capacites } from '@/lib/plan'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Impaye } from '@/lib/types/database'
import { lienRelanceImpaye } from '@/lib/whatsapp'

export const metadata: Metadata = { title: 'Impayés' }

export default async function PageImpayes() {
  const supabase = await creerClientServeur()

  // Comme sur `/app/logements` : la vue est scopée par RLS, pas par l'objet
  // `bailleur` (qui ne sert plus qu'à lire le droit aux relances WhatsApp).
  const [bailleur, { data }] = await Promise.all([
    bailleurOnboarde(),
    supabase
      .from('v_impayes')
      .select('*')
      // Tri par ancienneté, le plus ancien en haut (§6.1.8).
      .order('periode_debut', { ascending: true }),
  ])

  const impayes = (data ?? []) as Impaye[]
  const total = impayes.reduce((somme, i) => somme + Number(i.montant_du), 0)
  const relancesAutorisees = capacites(bailleur).relancesWhatsApp

  return (
    <div>
      <EnTetePage
        titre="Loyers en retard"
        description="Un loyer bascule ici lorsque son échéance est dépassée, tolérance comprise, et qu'il reste un solde impayé."
      />

      {impayes.length === 0 ? (
        <div className="card-sage">
          <p className="text-display-xs font-semibold text-ink-deep">
            Aucun loyer en retard
          </p>
          <p className="mt-sm text-body-md text-body">
            Tous les loyers échus ont été réglés. Rien à relancer aujourd&apos;hui.
          </p>
          <Link href="/app/paiements/nouveau" className="btn btn-primary mt-lg">
            Enregistrer un paiement
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-xl flex flex-wrap items-baseline gap-sm text-body-md">
            <span className="text-mute">
              {impayes.length} loyer{impayes.length > 1 ? 's' : ''} en retard ·
            </span>
            <strong className="text-display-xs font-semibold tabular text-negative">
              {formaterFCFA(total)} à recouvrer
            </strong>
          </div>

          {!relancesAutorisees ? (
            <div className="mb-xl">
              <Alerte ton="attention">
                Les relances WhatsApp sont réservées au plan Standard. Vous
                pouvez toujours consulter vos impayés et contacter vos locataires
                directement.{' '}
                <Link href="/app/parametres/abonnement" className="underline">
                  Voir le plan Standard
                </Link>
              </Alerte>
            </div>
          ) : null}

          <div className="space-y-md">
            {impayes.map((impaye) => {
              const lien = lienRelanceImpaye({
                locataireNom: impaye.locataire_nom,
                locataireTelephone: impaye.locataire_telephone,
                periodeDebut: impaye.periode_debut,
                montantDu: Number(impaye.montant_du),
                dateEcheance: impaye.date_echeance,
                bailleurNom: bailleur.nom,
              })

              return (
                <div
                  key={`${impaye.bail_id}-${impaye.periode_debut}`}
                  className="rounded-lg border border-hairline border-l-4 border-l-negative bg-surface-card p-lg"
                >
                  <div className="flex flex-wrap items-start justify-between gap-lg">
                    <div className="flex min-w-0 items-start gap-lg">
                      <AvatarPeep id={impaye.locataire_id} nom={impaye.locataire_nom} />
                      <div className="min-w-0">
                        <p className="truncate text-body-md font-semibold text-ink">
                          {impaye.locataire_nom}
                        </p>
                        <p className="truncate text-body-sm text-mute">
                          {impaye.logement_adresse}, {impaye.logement_ville}
                        </p>
                        <p className="mt-sm text-body-sm text-body">
                          Loyer de{' '}
                          <strong className="font-semibold">
                            {formaterPeriode(impaye.periode_debut)}
                          </strong>{' '}
                          · échéance du {formaterDate(impaye.date_echeance)} ·{' '}
                          {impaye.jours_de_retard} jour
                          {impaye.jours_de_retard > 1 ? 's' : ''} de retard
                        </p>
                        {Number(impaye.montant_paye) > 0 ? (
                          <p className="mt-xxs text-body-sm text-warning-deep">
                            Déjà réglé : {formaterFCFA(impaye.montant_paye)} sur{' '}
                            {formaterFCFA(impaye.loyer_mensuel)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-sm">
                      <Badge ton="negative">Impayé</Badge>
                      <p className="text-display-xs font-semibold tabular text-ink">
                        {formaterFCFA(impaye.montant_du)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-lg flex flex-wrap gap-sm border-t border-hairline-soft pt-lg">
                    {relancesAutorisees ? (
                      <a
                        href={lien}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                      >
                        Relancer par WhatsApp
                      </a>
                    ) : (
                      <Link
                        href="/app/parametres/abonnement"
                        className="btn btn-tertiary btn-sm"
                      >
                        Débloquer les relances
                      </Link>
                    )}

                    <Link
                      href={`/app/paiements/nouveau?bail=${impaye.bail_id}`}
                      className="btn btn-tertiary btn-sm"
                    >
                      Enregistrer le paiement
                    </Link>
                    <Link href={`/app/baux/${impaye.bail_id}`} className="btn btn-secondary btn-sm">
                      Voir le bail
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-xl text-body-sm text-mute">
            La relance ouvre WhatsApp avec un message pré-rempli. C&apos;est vous
            qui appuyez sur « Envoyer » — Sikaloc n&apos;envoie jamais de message à
            votre place.
          </p>
        </>
      )}
    </div>
  )
}
