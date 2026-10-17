import type { Metadata } from 'next'
import Link from 'next/link'

import { ResumeListe } from '@/components/ui/listes'
import { AvatarPeep } from '@/components/ui/avatar-peep'
import { Alerte, Badge, EnTetePage } from '@/components/ui/retours'
import { formaterDate, formaterFCFA, formaterPeriode } from '@/lib/format'
import { capacites } from '@/lib/plan'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Impaye } from '@/lib/types/database'
import { BoutonAction } from '@/components/ui/action-confirmee'
import { relancerParEmail } from '@/lib/actions/notifications'
import { lienRelanceImpaye } from '@/lib/whatsapp'

export const metadata: Metadata = { title: 'Impayés' }

export default async function PageImpayes() {
  const supabase = await creerClientServeur()

  // Comme sur `/pro/logements` : la vue est scopée par RLS, pas par l'objet
  // `bailleur` (qui ne sert plus qu'à lire le droit aux relances WhatsApp).
  const [bailleur, { data, error: erreurImpayes }] = await Promise.all([
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
  // La préférence du bailleur, enfin lue. Elle n'a jamais gouverné que
  // l'affichage des boutons WhatsApp — pas les boutons email, qui sont un
  // canal distinct et qui restent quel que soit ce réglage.
  const whatsappPropose = bailleur.notif_whatsapp !== false

  return (
    <div>
      <EnTetePage
        titre="Loyers en retard"
        description="Un loyer bascule ici lorsque son échéance est dépassée, tolérance comprise, et qu'il reste un solde impayé."
      />

      {erreurImpayes ? (
        <Alerte ton="erreur">Les loyers en retard ne peuvent pas être chargés. Actualisez la page pour réessayer.</Alerte>
      ) : impayes.length === 0 ? (
        <div className="card border-positive/30">
          <p className="section-title text-positive-deep">
            Aucun loyer en retard
          </p>
          <p className="mt-sm text-body-md text-body">
            Tous les loyers échus ont été réglés. Rien à relancer aujourd&apos;hui.
          </p>
          <Link href="/pro/paiements/nouveau" className="btn btn-primary mt-lg">
            Enregistrer un paiement
          </Link>
        </div>
      ) : (
        <>
          <ResumeListe>
            <span className="text-mute">
              {impayes.length} loyer{impayes.length > 1 ? 's' : ''} en retard
            </span>
            <strong className="money text-body-lg font-semibold text-negative-darkest">
              {formaterFCFA(total)}<span className="ml-xs text-body-sm font-normal text-mute">à recouvrer</span>
            </strong>
          </ResumeListe>

          {!relancesAutorisees ? (
            <div className="mb-xl">
              <Alerte ton="attention">
                Les relances WhatsApp sont réservées au plan Standard. Vous
                pouvez toujours consulter vos impayés et contacter vos locataires
                directement.{' '}
                <Link href="/pro/parametres/abonnement" className="underline">
                  Voir le plan Standard
                </Link>
              </Alerte>
            </div>
          ) : null}

          <ul className="space-y-sm" aria-label="Loyers en retard">
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
                <li
                  key={`${impaye.bail_id}-${impaye.periode_debut}`}
                  className="card list-card border-l-4 border-l-negative"
                >
                  <div className="list-row">
                    <div className="flex min-w-0 items-start gap-sm">
                      <AvatarPeep id={impaye.locataire_id} nom={impaye.locataire_nom} />
                      <div className="min-w-0">
                        <h2 className="list-title">
                          {impaye.locataire_nom}
                        </h2>
                        <p className="list-copy text-body-sm text-mute">
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
                          <p className="mt-xxs text-body-sm text-warning-content">
                            Déjà réglé : {formaterFCFA(impaye.montant_paye)} sur{' '}
                            {formaterFCFA(impaye.loyer_mensuel)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="list-aside">
                      <Badge ton="negative">Impayé</Badge>
                      <p className="money text-body-lg font-semibold text-ink">
                        {formaterFCFA(impaye.montant_du)}
                      </p>
                    </div>
                  </div>

                  <div className="list-actions">
                    {relancesAutorisees ? (
                      <>
                        {whatsappPropose ? (
                          <a
                            href={lien}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm"
                          >
                            Relancer par WhatsApp
                          </a>
                        ) : null}
                        {/*
                          Les deux canaux, et le bailleur choisit.

                          WhatsApp ouvre une application sur SON téléphone : le
                          message part de lui, immédiatement lu, mais Sikaloc
                          n'en garde rien. L'email part de Sikaloc — plus lent à
                          être lu, mais il laisse une trace datée, et il joint
                          un locataire dont on n'a pas le numéro sur WhatsApp.

                          Le montant qui part n'est pas celui affiché ici : il
                          est relu en base au moment du clic. Entre l'affichage
                          et le geste, le loyer a pu être réglé.
                        */}
                        <BoutonAction
                          action={relancerParEmail.bind(
                            null,
                            impaye.bail_id,
                            impaye.periode_debut,
                          )}
                          libelle="Relancer par email"
                          libelleEnCours="Envoi…"
                          variante="tertiary"
                          compact
                        />
                      </>
                    ) : (
                      <Link
                        href="/pro/parametres/abonnement"
                        className="btn btn-tertiary btn-sm"
                      >
                        Débloquer les relances
                      </Link>
                    )}

                    <Link
                      href={`/pro/paiements/nouveau?bail=${impaye.bail_id}`}
                      className="btn btn-tertiary btn-sm"
                    >
                      Enregistrer le paiement
                    </Link>
                    <Link href={`/pro/baux/${impaye.bail_id}`} className="btn btn-secondary btn-sm">
                      Voir le bail
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>

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
